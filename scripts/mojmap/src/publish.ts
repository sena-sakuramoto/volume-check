import type { Config } from './config.js';
import { uploadLocalFile, uploadBuffer, listPrefix, deleteKey, keyOf, publicUrl } from './gcs.js';
import { log } from './logger.js';

/**
 * Publish a freshly built PMTiles to GCS atomically.
 *
 * Flow:
 *   1. Upload the file to `moj/mojmap-YYYYMMDD-HHMMSS.pmtiles` (versioned key).
 *   2. Update the immutable pointer file `moj/current.txt` to the new key.
 *   3. Also mirror to the stable alias `moj/mojmap.pmtiles` for humans /
 *      manual verification — clients MUST rely on `current.txt`, not the alias.
 *   4. Garbage-collect old versioned PMTiles keeping the configured retention.
 */

export interface PublishResult {
  versionedKey: string;
  pointerKey: string;
  aliasKey: string;
  pmtilesUrl: string;
  currentUrl: string;
}

function timestamp(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}

export async function publishPmtiles(
  cfg: Config,
  localPmtilesPath: string,
  now: Date = new Date(),
): Promise<PublishResult> {
  const versionedKey = keyOf(cfg, [`mojmap-${timestamp(now)}.pmtiles`]);
  const pointerKey = keyOf(cfg, ['current.txt']);
  const aliasKey = keyOf(cfg, ['mojmap.pmtiles']);

  log.info('publish.start', { versionedKey });

  // Step 1 — upload versioned PMTiles.
  await uploadLocalFile(cfg, localPmtilesPath, versionedKey, {
    contentType: 'application/vnd.pmtiles',
    cacheControl: 'public, max-age=3600, immutable',
  });

  // Step 2 — flip the pointer. This is the "switch" — API readers resolve
  // this tiny (<100B) object to find the current PMTiles.
  await uploadBuffer(cfg, pointerKey, Buffer.from(`${versionedKey}\n`, 'utf-8'), {
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'no-store',
  });

  // Step 3 — alias for humans. Best-effort; a failure here does not unpublish.
  try {
    await uploadLocalFile(cfg, localPmtilesPath, aliasKey, {
      contentType: 'application/vnd.pmtiles',
      cacheControl: 'public, max-age=300',
    });
  } catch (err) {
    log.warn('publish.aliasFailed', { err: (err as Error).message });
  }

  // Step 4 — retention. Keep the N most recent versioned PMTiles (plus the
  // current one) and delete the rest. We scope the prefix tight so a bucket
  // policy that keeps unrelated objects can't accidentally get purged.
  try {
    const prefix = `${cfg.keyPrefix}/mojmap-`;
    const keys = await listPrefix(cfg, prefix);
    const candidates = keys.filter((k) => k.endsWith('.pmtiles')).sort();
    const keep = new Set<string>([versionedKey]);
    for (const k of candidates.slice(-cfg.pmtilesRetention)) keep.add(k);
    const toDelete = candidates.filter((k) => !keep.has(k));
    for (const k of toDelete) {
      await deleteKey(cfg, k);
      log.info('publish.gc', { deleted: k });
    }
  } catch (err) {
    log.warn('publish.gcFailed', { err: (err as Error).message });
  }

  return {
    versionedKey,
    pointerKey,
    aliasKey,
    pmtilesUrl: publicUrl(cfg, versionedKey),
    currentUrl: publicUrl(cfg, pointerKey),
  };
}
