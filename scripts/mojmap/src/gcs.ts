import { Storage, type Bucket } from '@google-cloud/storage';
import type { Config } from './config.js';
import { log } from './logger.js';

/**
 * Thin GCS helper. We intentionally avoid a fancy DI container — the rest
 * of the pipeline calls `getBucket(cfg)` whenever it needs access.
 *
 * Authentication relies on ADC (Application Default Credentials): Cloud Run
 * service accounts on the Job automatically, or `gcloud auth
 * application-default login` locally.
 */

let storage: Storage | null = null;

function getStorage(): Storage {
  if (!storage) storage = new Storage();
  return storage;
}

export function getBucket(cfg: Config): Bucket {
  return getStorage().bucket(cfg.bucket);
}

export function keyOf(cfg: Config, parts: string[]): string {
  return [cfg.keyPrefix, ...parts].filter(Boolean).join('/');
}

export async function downloadText(cfg: Config, key: string): Promise<string | null> {
  const file = getBucket(cfg).file(key);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buf] = await file.download();
  return buf.toString('utf-8');
}

export async function uploadBuffer(
  cfg: Config,
  key: string,
  buf: Buffer,
  opts: { contentType: string; cacheControl?: string } = { contentType: 'application/octet-stream' },
): Promise<void> {
  if (cfg.dryRun) {
    log.info('gcs.uploadBuffer.dry', { key, bytes: buf.length });
    return;
  }
  const file = getBucket(cfg).file(key);
  await file.save(buf, {
    resumable: false,
    contentType: opts.contentType,
    metadata: {
      cacheControl: opts.cacheControl ?? 'public, max-age=60',
    },
  });
}

export async function uploadLocalFile(
  cfg: Config,
  localPath: string,
  key: string,
  opts: { contentType: string; cacheControl?: string },
): Promise<void> {
  if (cfg.dryRun) {
    log.info('gcs.uploadLocalFile.dry', { localPath, key });
    return;
  }
  const file = getBucket(cfg).file(key);
  await file.save(await (await import('node:fs/promises')).readFile(localPath), {
    resumable: true,
    contentType: opts.contentType,
    metadata: {
      cacheControl: opts.cacheControl ?? 'public, max-age=3600',
    },
  });
}

export async function deleteKey(cfg: Config, key: string): Promise<void> {
  if (cfg.dryRun) {
    log.info('gcs.delete.dry', { key });
    return;
  }
  const file = getBucket(cfg).file(key);
  await file.delete({ ignoreNotFound: true });
}

export async function listPrefix(cfg: Config, prefix: string): Promise<string[]> {
  const [files] = await getBucket(cfg).getFiles({ prefix });
  return files.map((f) => f.name);
}

export function publicUrl(cfg: Config, key: string): string {
  return `https://storage.googleapis.com/${cfg.bucket}/${key}`;
}
