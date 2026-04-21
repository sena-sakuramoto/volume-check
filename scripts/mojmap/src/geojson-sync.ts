import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { Config } from './config.js';
import type { Manifest } from './types.js';
import { getBucket, keyOf } from './gcs.js';
import { log } from './logger.js';

/**
 * Keep the on-disk `out/geojson/{id}.ndjson.gz` cache in lock-step with the
 * GCS prefix `moj/geojson/{id}.ndjson.gz`. Before a PMTiles build we need
 * every known dataset's NDJSON.gz on disk — even the ones that weren't part
 * of today's diff — so we pull the remaining ones from GCS.
 *
 * Upload direction: call `uploadOne` for every newly parsed dataset. Download
 * direction: call `ensureAllPresent(manifest)` right before `buildPmtiles`.
 */

export function datasetGcsKey(cfg: Config, datasetId: string): string {
  return keyOf(cfg, ['geojson', `${datasetId}.ndjson.gz`]);
}

export async function uploadGeojson(
  cfg: Config,
  datasetId: string,
  localPath: string,
): Promise<string> {
  const key = datasetGcsKey(cfg, datasetId);
  if (cfg.dryRun) {
    log.info('geojson.upload.dry', { key });
    return key;
  }
  const file = getBucket(cfg).file(key);
  await new Promise<void>((resolve, reject) => {
    const ws = file.createWriteStream({
      resumable: true,
      contentType: 'application/x-ndjson',
      gzip: false, // already gzipped
      metadata: { cacheControl: 'public, max-age=3600' },
    });
    ws.on('error', reject);
    ws.on('finish', resolve);
    createReadStream(localPath).pipe(ws);
  });
  log.info('geojson.upload.ok', { key });
  return key;
}

export async function downloadGeojsonIfMissing(
  cfg: Config,
  datasetId: string,
): Promise<void> {
  const outDir = path.join(cfg.workDir, 'geojson');
  await mkdir(outDir, { recursive: true });
  const localPath = path.join(outDir, `${datasetId}.ndjson.gz`);
  try {
    const s = await stat(localPath);
    if (s.size > 0) return;
  } catch {
    // fall through
  }
  const key = datasetGcsKey(cfg, datasetId);
  const file = getBucket(cfg).file(key);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`missing both locally and on GCS: ${key}`);
  }
  await pipeline(file.createReadStream(), createWriteStream(localPath));
  log.info('geojson.download.ok', { key });
}

/**
 * Guarantee every dataset mentioned in the manifest has a local NDJSON.gz.
 * Returns the list of dataset ids that were pulled from GCS (useful for
 * progress reporting).
 */
export async function ensureAllPresent(cfg: Config, manifest: Manifest): Promise<string[]> {
  const ids = Object.keys(manifest.datasets);
  const pulled: string[] = [];
  for (const id of ids) {
    const localPath = path.join(cfg.workDir, 'geojson', `${id}.ndjson.gz`);
    try {
      const s = await stat(localPath);
      if (s.size > 0) continue;
    } catch {
      // missing
    }
    await downloadGeojsonIfMissing(cfg, id);
    pulled.push(id);
  }
  return pulled;
}

/**
 * Write a bucket `phase1.listing.json` with all geojson keys for debugging
 * purposes. Purely diagnostic — the build pipeline doesn't need it.
 */
export async function writeListing(cfg: Config, manifest: Manifest): Promise<void> {
  const listing = {
    generatedAt: new Date().toISOString(),
    bucket: cfg.bucket,
    prefix: cfg.keyPrefix,
    datasets: Object.keys(manifest.datasets).sort(),
  };
  const outDir = path.join(cfg.workDir);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, 'listing.json'),
    JSON.stringify(listing, null, 2),
    'utf-8',
  );
}

/**
 * Snapshot all local NDJSON.gz filenames (used by PMTiles build as input set).
 */
export async function localGeojsonFiles(cfg: Config): Promise<string[]> {
  const dir = path.join(cfg.workDir, 'geojson');
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith('.ndjson.gz')).map((e) => path.join(dir, e));
  } catch {
    return [];
  }
}
