import { request } from 'undici';
import type { Config } from './config.js';
import type { CkanPackage, CkanResource, ResolvedDataset } from './types.js';
import { isPhase1 } from './phase1.js';
import { log } from './logger.js';

/**
 * G空間情報センター CKAN API client.
 *
 * The G空間 instance is a stock CKAN 3.x deployment, so the action API is
 * accessed at `${base}/action/package_search`. We paginate in 200-row pages
 * which is well under CKAN's hard limit (1000) but reduces per-request cost.
 */

const PAGE_SIZE = 200;

interface CkanActionResponse<T> {
  success: boolean;
  result: T;
  error?: { message?: string };
}

interface CkanSearchResult {
  count: number;
  results: CkanPackage[];
}

interface RawCkanPackage extends Omit<CkanPackage, 'municipalityCode'> {
  extras?: Array<{ key: string; value: string }>;
  tags?: Array<{ name: string }>;
}

/**
 * Best-effort extraction of the JIS X 0402 5-digit municipality code from
 * a CKAN package. G空間 datasets are not perfectly consistent so we try
 * multiple signals in priority order.
 */
export function extractMunicipalityCode(pkg: RawCkanPackage): string | null {
  const extras = pkg.extras ?? [];
  const extraMatch =
    extras.find((e) =>
      ['全国地方公共団体コード', '地方公共団体コード', '市区町村コード', '自治体コード'].includes(e.key),
    )?.value ??
    extras.find((e) => /^\d{5}$/.test(String(e.value ?? '')))?.value;
  if (extraMatch && /^\d{5}$/.test(extraMatch)) return extraMatch;

  const tags = pkg.tags ?? [];
  for (const t of tags) {
    if (/^\d{5}$/.test(t.name ?? '')) return t.name;
  }

  // Title / name fallback — match the first 5-digit run that is NOT preceded
  // by another digit (避ける: 6桁以上の連番が偶然 5桁部分列にマッチするのを)。
  const src = `${pkg.title ?? ''} ${pkg.name ?? ''}`;
  const m = src.match(/(?<!\d)(\d{5})(?!\d)/);
  if (m) return m[1];

  return null;
}

function pickZipResource(resources: CkanResource[]): CkanResource | null {
  // Prefer explicit ZIP, fall back to anything whose URL ends in .zip.
  const byFormat = resources.find(
    (r) => typeof r.format === 'string' && r.format.toLowerCase().includes('zip'),
  );
  if (byFormat) return byFormat;
  return resources.find((r) => typeof r.url === 'string' && r.url.toLowerCase().endsWith('.zip')) ?? null;
}

async function callCkan<T>(cfg: Config, path: string): Promise<T> {
  const url = `${cfg.ckanBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    bodyTimeout: cfg.httpTimeoutMs,
    headersTimeout: cfg.httpTimeoutMs,
  });
  const text = await body.text();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`CKAN ${path} HTTP ${statusCode}: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as CkanActionResponse<T>;
  if (!json.success) {
    throw new Error(`CKAN ${path} returned success=false: ${json.error?.message ?? 'unknown'}`);
  }
  return json.result;
}

/**
 * Search G空間 CKAN for 登記所備付地図 packages and yield a normalised,
 * Phase-1-filtered list of datasets ready to be planned for download.
 */
export async function fetchPhase1Datasets(cfg: Config): Promise<ResolvedDataset[]> {
  const query = encodeURIComponent('登記所備付地図');
  const out: ResolvedDataset[] = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const result = await callCkan<CkanSearchResult>(
      cfg,
      `action/package_search?q=${query}&rows=${PAGE_SIZE}&start=${start}`,
    );
    total = result.count;
    log.info('ckan.page', { start, returned: result.results.length, total });
    if (result.results.length === 0) break;

    for (const raw of result.results as unknown as RawCkanPackage[]) {
      const municipalityCode = extractMunicipalityCode(raw);
      if (!isPhase1(municipalityCode)) continue;
      const zip = pickZipResource(raw.resources ?? []);
      if (!zip || !zip.url) continue;
      out.push({
        id: raw.name, // stable human-readable slug
        ckanId: raw.id,
        name: raw.name,
        title: raw.title,
        ckanModified: raw.metadata_modified,
        municipalityCode: municipalityCode!,
        zipUrl: zip.url,
        zipResourceId: zip.id,
      });
    }
    start += result.results.length;
    if (result.results.length < PAGE_SIZE) break; // defensive — avoid infinite loop on API weirdness
  }

  log.info('ckan.phase1', { matched: out.length });
  return out;
}
