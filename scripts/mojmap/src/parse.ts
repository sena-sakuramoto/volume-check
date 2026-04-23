import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import type { Config } from './config.js';
import type { ResolvedDataset } from './types.js';
import { log } from './logger.js';

/**
 * Parse a downloaded MOJ-MAP ZIP into GeoJSON NDJSON using the `mojxml-rs`
 * CLI (https://github.com/KotobaMedia/mojxml-rs). The Rust CLI handles:
 *  - ZIP extraction (including nested files),
 *  - JIS X 7307 XML decode (Shift_JIS / UTF-8 autodetect),
 *  - Japan Plane Rectangular → WGS84 transform (CRS zone is declared in
 *    the XML itself, so the converter picks it up automatically).
 *
 * We layer our own property normalisation on top so tippecanoe sees a
 * consistent schema with `source: 'moj'`, zenkaku-normalised `chiban`, and
 * the municipality code.
 *
 * CLI shape (verified against upstream README):
 *   mojxml-rs [OPTIONS] <DST_FILE> <SRC_FILES>...
 *
 * Output format is selected by the destination extension — `.json` emits
 * newline-delimited GeoJSON which is exactly what tippecanoe wants.
 */

export interface ParseResult {
  /** Path to the gzipped NDJSON on disk. */
  ndjsonGzPath: string;
  featureCount: number;
}

interface RawFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

const ZENKAKU_DIGITS_RE = /[０-９]/g;
const ZENKAKU_HYPHEN_RE = /[－―ー−‐]/g;

function normaliseChiban(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s
    .replace(ZENKAKU_DIGITS_RE, (ch) => String(String.fromCharCode(ch.charCodeAt(0) - 0xfee0)))
    .replace(ZENKAKU_HYPHEN_RE, '-')
    .replace(/\s+/g, '');
  return s;
}

function normaliseProperties(
  props: Record<string, unknown>,
  municipalityCode: string,
  ckanModified: string,
): Record<string, unknown> {
  const chiban = normaliseChiban(props['地番'] ?? props.chiban);
  const out: Record<string, unknown> = {
    ...props,
    source: 'moj',
    municipalityCode,
    updated_at: ckanModified.slice(0, 10),
  };
  if (chiban) {
    out.chiban = chiban;
    out['地番'] = chiban;
  }
  return out;
}

export async function parseZipToNdjsonGz(
  cfg: Config,
  ds: ResolvedDataset,
  zipPath: string,
): Promise<ParseResult> {
  const outDir = path.join(cfg.workDir, 'geojson');
  await mkdir(outDir, { recursive: true });
  // mojxml-rs selects the writer by extension: `.geojson` = newline-delimited
  // GeoJSON, `.fgb` = FlatGeobuf, `.parquet` = GeoParquet. We use NDJSON
  // because tippecanoe ingests it natively.
  const ndjsonPath = path.join(outDir, `${ds.id}.raw.geojson`);
  const ndjsonGzPath = path.join(outDir, `${ds.id}.ndjson.gz`);

  // 1. mojxml-rs writes to its destination file directly. `-c` pulls in
  //    chikugai (地区外) features too; we keep those so adjacent parcels at
  //    ward boundaries aren't silently dropped.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      cfg.mojxmlBin,
      ['-c', ndjsonPath, zipPath],
      { stdio: ['ignore', 'inherit', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (b) => {
      stderr += b.toString('utf-8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`mojxml-rs exited ${code}: ${stderr.slice(0, 400)}`));
    });
  });

  // 2. Stream NDJSON → property-normalised NDJSON → gzip.
  const featureCount = await (async () => {
    const reader = createInterface({ input: createReadStream(ndjsonPath, 'utf-8') });
    const gzip = createGzip({ level: 6 });
    const gzSink = createWriteStream(ndjsonGzPath);
    const pipelinePromise = pipeline(gzip, gzSink);
    let count = 0;
    try {
      for await (const line of reader) {
        if (!line.trim()) continue;
        let feat: RawFeature;
        try {
          feat = JSON.parse(line) as RawFeature;
        } catch (err) {
          log.warn('parse.badLine', { datasetId: ds.id, err: (err as Error).message });
          continue;
        }
        if (!feat.geometry || !feat.properties) continue;
        feat.properties = normaliseProperties(feat.properties, ds.municipalityCode, ds.ckanModified);
        gzip.write(`${JSON.stringify(feat)}\n`);
        count++;
      }
    } finally {
      gzip.end();
      await pipelinePromise;
    }
    return count;
  })();

  // 3. Remove the raw NDJSON — the gzipped version is the persistent artifact.
  await rm(ndjsonPath, { force: true });
  log.info('parse.ok', { datasetId: ds.id, features: featureCount, zipPath, ndjsonGzPath });
  return { ndjsonGzPath, featureCount };
}

/**
 * Write a small sidecar JSON describing a dataset's parsed state. Handy for
 * rebuilding the manifest from local geojson cache when the GCS manifest is
 * accidentally wiped.
 */
export async function writeSidecar(
  cfg: Config,
  ds: ResolvedDataset,
  featureCount: number,
  zipSha256: string,
): Promise<void> {
  const outDir = path.join(cfg.workDir, 'geojson');
  const sidecar = path.join(outDir, `${ds.id}.meta.json`);
  await writeFile(
    sidecar,
    JSON.stringify(
      {
        ckanId: ds.ckanId,
        ckanModified: ds.ckanModified,
        municipalityCode: ds.municipalityCode,
        zipSha256,
        featureCount,
      },
      null,
      2,
    ),
    'utf-8',
  );
}
