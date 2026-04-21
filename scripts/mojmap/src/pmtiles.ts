import { spawn } from 'node:child_process';
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Config } from './config.js';
import { log } from './logger.js';

/**
 * Thin wrapper around `tippecanoe` for building MOJ-MAP PMTiles.
 *
 * tippecanoe is not incremental — any change in the underlying geojson set
 * forces a full rebuild. That is acceptable at Phase 1 scale (≤1.5GB NDJSON
 * gzipped) but the Dockerfile pins `--read-parallel` and `--drop-densest-as-
 * needed` so we degrade gracefully at Phase 2 scale.
 */

export interface BuildPmtilesInput {
  /** Directory containing one `*.ndjson.gz` per dataset. */
  geojsonDir: string;
  /** Output path for the built `.pmtiles` file. */
  outPath: string;
}

export async function buildPmtiles(cfg: Config, input: BuildPmtilesInput): Promise<void> {
  await mkdir(path.dirname(input.outPath), { recursive: true });
  const entries = (await readdir(input.geojsonDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.ndjson.gz'))
    .map((e) => path.join(input.geojsonDir, e.name));
  if (entries.length === 0) {
    throw new Error(`no NDJSON.gz inputs found in ${input.geojsonDir}`);
  }

  const args = [
    '-o', input.outPath,
    '--layer=fude',
    '--force',
    `--minimum-zoom=${cfg.tippecanoeMinZoom}`,
    `--maximum-zoom=${cfg.tippecanoeMaxZoom}`,
    '--drop-densest-as-needed',
    '--extend-zooms-if-still-dropping',
    '--read-parallel',
    '--coalesce-densest-as-needed',
    ...entries,
  ];
  log.info('pmtiles.build.start', { out: input.outPath, inputs: entries.length });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cfg.tippecanoeBin, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`tippecanoe exited ${code}`));
    });
  });
  const { size } = await stat(input.outPath);
  log.info('pmtiles.build.done', { out: input.outPath, bytes: size });
}
