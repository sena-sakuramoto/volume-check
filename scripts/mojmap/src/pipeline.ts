import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Config } from './config.js';
import type { DatasetResult, DatasetUpdatePlan, Manifest } from './types.js';
import { loadConfig } from './config.js';
import { fetchPhase1Datasets } from './ckan.js';
import { loadManifest, saveManifest, planUpdates, applyResults, emptyManifest } from './manifest.js';
import { downloadZip, downloadAll } from './download.js';
import { parseZipToNdjsonGz, writeSidecar } from './parse.js';
import { uploadGeojson, ensureAllPresent, writeListing } from './geojson-sync.js';
import { buildPmtiles } from './pmtiles.js';
import { publishPmtiles } from './publish.js';
import { log } from './logger.js';

/**
 * Single entry point for both `mojmap:daily` and `mojmap:full`. The `mode`
 * toggles `forceFull` inside the config load step so the plan-updates step
 * picks every dataset regardless of manifest state.
 */

export interface RunOptions {
  mode: 'daily' | 'full';
  configOverrides?: Partial<Config>;
}

export interface RunResult {
  planCount: number;
  succeeded: number;
  failed: number;
  pmtilesPublished: boolean;
  versionedKey?: string;
  skippedReason?: string;
}

export async function run(opts: RunOptions): Promise<RunResult> {
  const cfg = loadConfig({
    ...opts.configOverrides,
    forceFull: opts.mode === 'full' ? true : (opts.configOverrides?.forceFull ?? false),
  });
  await mkdir(cfg.workDir, { recursive: true });
  await mkdir(path.join(cfg.workDir, 'zips'), { recursive: true });
  await mkdir(path.join(cfg.workDir, 'geojson'), { recursive: true });

  log.info('run.start', { mode: opts.mode, bucket: cfg.bucket, dryRun: cfg.dryRun });

  // 1. CKAN enumeration.
  const datasets = await fetchPhase1Datasets(cfg);
  if (datasets.length === 0) {
    log.warn('run.noDatasets', { mode: opts.mode });
    return { planCount: 0, succeeded: 0, failed: 0, pmtilesPublished: false, skippedReason: 'ckan-empty' };
  }

  // 2. Load manifest + plan diff.
  const manifest = opts.mode === 'full' ? emptyManifest() : await loadManifest(cfg);
  const plans = planUpdates(cfg, manifest, datasets);
  log.info('run.plan', { total: datasets.length, toUpdate: plans.length, mode: opts.mode });

  if (plans.length === 0 && Object.keys(manifest.datasets).length > 0) {
    // Nothing to update AND the manifest already has data → fast path, no rebuild.
    log.info('run.noChanges', {});
    return {
      planCount: 0,
      succeeded: 0,
      failed: 0,
      pmtilesPublished: false,
      skippedReason: 'no-changes',
    };
  }

  // 3. Download + parse per-dataset, with bounded concurrency.
  const results: DatasetResult[] = [];
  await downloadAll(cfg, plans, async (plan: DatasetUpdatePlan) => {
    const ds = plan.dataset;
    try {
      const { localPath, sha256, fromCache } = await downloadZip(cfg, ds.zipUrl, ds.id, {
        expectedSha256: plan.previousZipSha256,
      });
      if (fromCache && plan.previousZipSha256 === sha256 && plan.reason === 'modified') {
        // Content-addressed short-circuit: CKAN bumped metadata_modified but
        // the ZIP body is byte-identical, so a reparse is wasted work.
        log.info('dataset.cacheShortCircuit', { datasetId: ds.id });
        results.push({
          datasetId: ds.id,
          ok: true,
          zipSha256: sha256,
          featureCount: -1, // sentinel — caller keeps previous count
        });
        return;
      }
      const parsed = await parseZipToNdjsonGz(cfg, ds, localPath);
      await writeSidecar(cfg, ds, parsed.featureCount, sha256);
      const gcsKey = await uploadGeojson(cfg, ds.id, parsed.ndjsonGzPath);
      results.push({
        datasetId: ds.id,
        ok: true,
        zipSha256: sha256,
        featureCount: parsed.featureCount,
        geojsonGcsKey: gcsKey,
      });
    } catch (err) {
      log.error('dataset.failed', { datasetId: ds.id, err: (err as Error).message });
      results.push({ datasetId: ds.id, ok: false, error: (err as Error).message });
    }
  });

  // 4. Merge results → new manifest. Preserve featureCount for cache-short-
  //    circuited datasets by copying from the prior manifest entry.
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  let nextManifest: Manifest = applyResults(manifest, results.map((r) => {
    if (r.ok && r.featureCount === -1) {
      const prev = manifest.datasets[r.datasetId];
      return { ...r, featureCount: prev?.featureCount ?? 0 };
    }
    return r;
  }), plans);

  // 5. Ensure all known datasets are present locally before tippecanoe.
  const pulled = await ensureAllPresent(cfg, nextManifest);
  log.info('run.pulledCache', { count: pulled.length });
  await writeListing(cfg, nextManifest);

  // 6. Build PMTiles + publish — only if there is at least one parsed dataset.
  //    We require a surviving dataset instead of just "any mutation" so that
  //    a mode=full run where 100% of downloads failed exits with a useful
  //    error instead of tippecanoe complaining about empty input.
  const haveAnyData = Object.values(nextManifest.datasets).some((d) => d.zipSha256);
  const shouldPublish =
    haveAnyData &&
    (results.some((r) => r.ok && r.featureCount !== -1) || opts.mode === 'full');
  let pmtilesPublished = false;
  let versionedKey: string | undefined;
  if (shouldPublish) {
    const pmtilesPath = path.join(cfg.workDir, 'mojmap.pmtiles');
    await buildPmtiles(cfg, {
      geojsonDir: path.join(cfg.workDir, 'geojson'),
      outPath: pmtilesPath,
    });
    const publishResult = await publishPmtiles(cfg, pmtilesPath);
    versionedKey = publishResult.versionedKey;
    nextManifest = {
      ...nextManifest,
      lastPmtilesObject: publishResult.versionedKey,
      lastFullRebuildAt: opts.mode === 'full' ? new Date().toISOString() : nextManifest.lastFullRebuildAt,
    };
    pmtilesPublished = true;
    log.info('run.publish.ok', publishResult as unknown as Record<string, unknown>);
  } else if (!haveAnyData) {
    log.warn('run.publish.skipped', { reason: 'no successfully parsed datasets — check download logs' });
  } else {
    log.info('run.publish.skipped', { reason: 'no mutating results' });
  }

  // 7. Commit the manifest last so a failure in publish rolls us back to the
  //    prior CKAN state without updating the bookkeeping.
  await saveManifest(cfg, nextManifest);

  log.info('run.done', { planCount: plans.length, succeeded, failed, pmtilesPublished });
  return { planCount: plans.length, succeeded, failed, pmtilesPublished, versionedKey };
}
