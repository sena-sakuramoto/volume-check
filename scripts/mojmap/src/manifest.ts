import type { Manifest, ManifestDataset, DatasetResult, ResolvedDataset, DatasetUpdatePlan } from './types.js';
import type { Config } from './config.js';
import { downloadText, uploadBuffer, keyOf } from './gcs.js';
import { log } from './logger.js';

const MANIFEST_KEY_PARTS = ['_state', 'manifest.json'];
const FAILURE_RETRY_GRACE_MS = 25 * 60 * 60 * 1000; // 25h — retry the next day even if metadata_modified didn't move

export function emptyManifest(): Manifest {
  return {
    schema: 1,
    phase: 1,
    lastFullRebuildAt: null,
    lastPmtilesObject: null,
    datasets: {},
  };
}

export async function loadManifest(cfg: Config): Promise<Manifest> {
  const key = keyOf(cfg, MANIFEST_KEY_PARTS);
  const raw = await downloadText(cfg, key);
  if (!raw) {
    log.info('manifest.load.empty', { key });
    return emptyManifest();
  }
  try {
    const parsed = JSON.parse(raw) as Manifest;
    if (parsed.schema !== 1) {
      throw new Error(`unsupported manifest schema: ${parsed.schema}`);
    }
    return parsed;
  } catch (err) {
    throw new Error(`manifest.json is unreadable at ${key}: ${(err as Error).message}`);
  }
}

export async function saveManifest(cfg: Config, manifest: Manifest): Promise<void> {
  const key = keyOf(cfg, MANIFEST_KEY_PARTS);
  const body = Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8');
  await uploadBuffer(cfg, key, body, {
    contentType: 'application/json',
    cacheControl: 'no-store',
  });
  log.info('manifest.save', { key, datasets: Object.keys(manifest.datasets).length });
}

/**
 * Plan which datasets need to be re-processed. A dataset is picked up when:
 *   - it has no manifest entry (new);
 *   - CKAN metadata_modified moved forward (modified);
 *   - it failed the last run and 25h have elapsed (retry);
 *   - forceFull is true (forced).
 *
 * The previous zip sha256 is returned so the downloader can skip the XML
 * parse step when the ZIP content turns out to be byte-identical despite
 * metadata_modified advancing.
 */
export function planUpdates(
  cfg: Config,
  manifest: Manifest,
  datasets: ResolvedDataset[],
  now: Date = new Date(),
): DatasetUpdatePlan[] {
  const plans: DatasetUpdatePlan[] = [];
  for (const ds of datasets) {
    const prev = manifest.datasets[ds.id];
    if (cfg.forceFull) {
      plans.push({ dataset: ds, reason: 'forced', previousZipSha256: prev?.zipSha256 ?? null });
      continue;
    }
    if (!prev) {
      plans.push({ dataset: ds, reason: 'new', previousZipSha256: null });
      continue;
    }
    if (prev.ckanModified !== ds.ckanModified) {
      plans.push({ dataset: ds, reason: 'modified', previousZipSha256: prev.zipSha256 });
      continue;
    }
    if (prev.failureStreak && prev.failureStreak > 0) {
      const ingested = Date.parse(prev.ingestedAt);
      if (!Number.isFinite(ingested) || now.getTime() - ingested >= FAILURE_RETRY_GRACE_MS) {
        plans.push({ dataset: ds, reason: 'retry', previousZipSha256: prev.zipSha256 });
      }
    }
  }
  return plans;
}

export function applyResults(
  manifest: Manifest,
  results: DatasetResult[],
  plans: DatasetUpdatePlan[],
  now: Date = new Date(),
): Manifest {
  const next: Manifest = {
    ...manifest,
    datasets: { ...manifest.datasets },
  };
  const planById = new Map(plans.map((p) => [p.dataset.id, p]));
  for (const r of results) {
    const plan = planById.get(r.datasetId);
    if (!plan) continue;
    const existing = next.datasets[r.datasetId];
    if (r.ok && r.zipSha256 && r.featureCount !== undefined) {
      const entry: ManifestDataset = {
        ckanId: plan.dataset.ckanId,
        ckanModified: plan.dataset.ckanModified,
        zipSha256: r.zipSha256,
        featureCount: r.featureCount,
        ingestedAt: now.toISOString(),
      };
      next.datasets[r.datasetId] = entry;
    } else {
      const streak = (existing?.failureStreak ?? 0) + 1;
      next.datasets[r.datasetId] = {
        ckanId: plan.dataset.ckanId,
        // Keep prior successful ckanModified so a transient failure does not
        // mark the dataset as "caught up" — we must retry later.
        ckanModified: existing?.ckanModified ?? '',
        zipSha256: existing?.zipSha256 ?? '',
        featureCount: existing?.featureCount ?? 0,
        ingestedAt: now.toISOString(),
        failureStreak: streak,
        lastError: (r.error ?? 'unknown').slice(0, 500),
      };
    }
  }
  return next;
}
