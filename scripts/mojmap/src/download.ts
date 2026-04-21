import { request, interceptors, Agent } from 'undici';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { Config } from './config.js';
import { log } from './logger.js';
import { MOJMAP_HTTP_HEADERS } from './ckan.js';

// Default dispatcher wrapped with a redirect interceptor — G空間 CKAN
// /download/ URLs 302 to pre-signed S3 URLs and undici does not follow
// redirects on a bare `request()` call. Using a dispatcher keeps the
// behaviour transparent to callers.
const redirectingDispatcher = new Agent().compose(interceptors.redirect({ maxRedirections: 10 }));

/**
 * Download a single ZIP with sha256 verification. We retry transient failures
 * with exponential backoff (3 attempts total). The caller is responsible for
 * expiring the on-disk cache — if the file already exists and matches the
 * expected sha256 we skip the network hit entirely.
 */

export interface DownloadedZip {
  localPath: string;
  sha256: string;
  size: number;
  fromCache: boolean;
}

async function sha256File(p: string): Promise<string> {
  const { createReadStream } = await import('node:fs');
  const hash = createHash('sha256');
  await pipeline(createReadStream(p), hash);
  return hash.digest('hex');
}

async function downloadOnce(cfg: Config, url: string, dest: string): Promise<{ sha256: string; size: number }> {
  // Follow redirects via the shared dispatcher — see top of file.
  const resp = await request(url, {
    method: 'GET',
    headers: { ...MOJMAP_HTTP_HEADERS, accept: '*/*' },
    bodyTimeout: cfg.httpTimeoutMs,
    headersTimeout: cfg.httpTimeoutMs,
    dispatcher: redirectingDispatcher,
  });
  if (resp.statusCode < 200 || resp.statusCode >= 300) {
    throw new Error(`HTTP ${resp.statusCode} for ${url}`);
  }
  const hash = createHash('sha256');
  let size = 0;
  const writer = createWriteStream(dest);
  // undici's body is an async iterable of Uint8Array chunks. Hash-and-write
  // is straightforward with a for-await loop; no TransformStream needed.
  try {
    for await (const chunk of resp.body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      size += chunk.byteLength;
      if (!writer.write(chunk)) {
        await new Promise<void>((resolve) => writer.once('drain', () => resolve()));
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      writer.end((err: NodeJS.ErrnoException | null | undefined) =>
        err ? reject(err) : resolve(),
      );
    });
  }
  return { sha256: hash.digest('hex'), size };
}

export async function downloadZip(
  cfg: Config,
  url: string,
  datasetId: string,
  opts: { expectedSha256?: string | null } = {},
): Promise<DownloadedZip> {
  const dir = path.join(cfg.workDir, 'zips');
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${datasetId}.zip`);

  try {
    const st = await stat(dest);
    if (st.size > 0) {
      const existingSha = await sha256File(dest);
      if (opts.expectedSha256 && opts.expectedSha256 === existingSha) {
        log.info('download.cacheHit', { datasetId, sha256: existingSha });
        return { localPath: dest, sha256: existingSha, size: st.size, fromCache: true };
      }
    }
  } catch {
    // absent or unreadable — fall through to fresh download
  }

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < 3) {
    attempt++;
    try {
      const { sha256, size } = await downloadOnce(cfg, url, dest);
      log.info('download.ok', { datasetId, attempt, size, sha256 });
      return { localPath: dest, sha256, size, fromCache: false };
    } catch (err) {
      lastErr = err;
      log.warn('download.fail', { datasetId, attempt, err: (err as Error).message });
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.random() * 200));
      }
    }
  }
  throw new Error(`download failed after 3 attempts: ${(lastErr as Error).message}`);
}

/**
 * Cap simultaneous downloads at `cfg.downloadConcurrency`. Each task wraps
 * `downloadZip`; per-dataset failures are surfaced as rejected promises so
 * the caller can record them into the manifest as failures.
 */
export async function downloadAll<T>(
  cfg: Config,
  items: T[],
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = items.slice();
  const concurrency = Math.max(1, cfg.downloadConcurrency);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const item = queue.shift();
          if (item === undefined) return;
          await worker(item);
        }
      })(),
    );
  }
  await Promise.all(workers);
}
