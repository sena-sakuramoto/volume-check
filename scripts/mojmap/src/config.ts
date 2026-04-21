/**
 * Runtime configuration for the MOJ-MAP pipeline. All environment-derived
 * values live here so the rest of the pipeline can be pure functions that
 * take a `Config` argument — makes dry-run and unit testing straightforward.
 */

export interface Config {
  /** GCS bucket name (without `gs://`). Holds PMTiles, manifest, geojson cache. */
  bucket: string;
  /** Key prefix inside the bucket for MOJ data. Trailing slash stripped. */
  keyPrefix: string;
  /** Local scratch directory for intermediate files. */
  workDir: string;
  /** CKAN API base URL. */
  ckanBase: string;
  /** Max parallel ZIP downloads. */
  downloadConcurrency: number;
  /** Per-request HTTP timeout (ms). */
  httpTimeoutMs: number;
  /** Path to the mojxml-rs binary. `mojxml-rs` on PATH by default. */
  mojxmlBin: string;
  /** Path to the tippecanoe binary. `tippecanoe` on PATH by default. */
  tippecanoeBin: string;
  /** Dry-run flag — skip network writes and report what would happen. */
  dryRun: boolean;
  /** Number of historical PMTiles objects to keep in the bucket. */
  pmtilesRetention: number;
  /**
   * Force a full rebuild regardless of the manifest state. Set by the
   * mojmap:full entry-point. Has the same effect as deleting manifest.json.
   */
  forceFull: boolean;
  /** Absolute timeout for the whole pipeline run (ms). */
  pipelineTimeoutMs: number;
  /** tippecanoe zoom range. */
  tippecanoeMinZoom: number;
  tippecanoeMaxZoom: number;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined) return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  const base: Config = {
    bucket: process.env.MOJMAP_BUCKET ?? 'volans-web-parcel-data',
    keyPrefix: (process.env.MOJMAP_KEY_PREFIX ?? 'moj').replace(/\/+$/g, ''),
    workDir: process.env.MOJMAP_WORKDIR ?? './out',
    ckanBase: process.env.MOJMAP_CKAN_BASE ?? 'https://www.geospatial.jp/ckan/api/3',
    downloadConcurrency: envInt('MOJMAP_DOWNLOAD_CONCURRENCY', 16),
    httpTimeoutMs: envInt('MOJMAP_HTTP_TIMEOUT_MS', 60_000),
    mojxmlBin: process.env.MOJMAP_MOJXML_BIN ?? 'mojxml-rs',
    tippecanoeBin: process.env.MOJMAP_TIPPECANOE_BIN ?? 'tippecanoe',
    dryRun: envBool('MOJMAP_DRY_RUN', false),
    pmtilesRetention: envInt('MOJMAP_PMTILES_RETENTION', 2),
    forceFull: envBool('MOJMAP_FORCE_FULL', false),
    pipelineTimeoutMs: envInt('MOJMAP_PIPELINE_TIMEOUT_MS', 4 * 60 * 60 * 1000),
    tippecanoeMinZoom: envInt('MOJMAP_TIPPECANOE_MIN_ZOOM', 13),
    tippecanoeMaxZoom: envInt('MOJMAP_TIPPECANOE_MAX_ZOOM', 18),
  };
  return { ...base, ...overrides };
}
