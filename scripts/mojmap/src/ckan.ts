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
 * a CKAN package. G空間 登記所備付地図 packages do not publish the code as
 * a canonical extra — the most reliable signal is the ZIP resource's
 * filename, which starts with the 5-digit code (e.g.
 * `13104-3902-2024.zip` = 新宿区 / `16343-2301-2024.zip` = 富山県朝日町).
 * We still fall back to extras/tags/title in case naming conventions vary.
 */
export function extractMunicipalityCode(pkg: RawCkanPackage): string | null {
  // 1. ZIP resource filename: `{5-digit}-...`  — primary signal.
  for (const r of pkg.resources ?? []) {
    const url = r.url ?? '';
    const filename = url.split('/').pop() ?? '';
    const m = filename.match(/^(\d{5})-/);
    if (m) return m[1];
    const nameM = (r.name ?? '').match(/^(\d{5})-/);
    if (nameM) return nameM[1];
  }

  // 2. Canonical extras keys — uncommon on G空間 but free-form portals vary.
  const extras = pkg.extras ?? [];
  const extraMatch =
    extras.find((e) =>
      ['全国地方公共団体コード', '地方公共団体コード', '市区町村コード', '自治体コード'].includes(e.key),
    )?.value ??
    extras.find((e) => /^\d{5}$/.test(String(e.value ?? '')))?.value;
  if (extraMatch && /^\d{5}$/.test(extraMatch)) return extraMatch;

  // 3. 5-digit tag.
  const tags = pkg.tags ?? [];
  for (const t of tags) {
    if (/^\d{5}$/.test(t.name ?? '')) return t.name;
  }

  // 4. Title / package name — match the first 5-digit run that is NOT
  //    preceded or followed by another digit (避ける: 6桁以上の連番が偶然
  //    5桁部分列にマッチするのを)。
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

// G空間 front-end sits behind a CDN/WAF that 403s requests whose User-Agent
// matches `undici`/`node-fetch`/empty or that include SDK-identifier fragments.
// A plain desktop Chrome UA string goes through cleanly from both local dev
// and Cloud Run egress. Accept-Language nudges error pages to Japanese in
// the rare case the WAF returns one, making log inspection easier.
const HTTP_HEADERS = {
  accept: 'application/json',
  'accept-language': 'ja,en-US;q=0.9,en;q=0.8',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
} as const;

async function callCkan<T>(cfg: Config, path: string): Promise<T> {
  const url = `${cfg.ckanBase.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  const { statusCode, body } = await request(url, {
    method: 'GET',
    headers: { ...HTTP_HEADERS },
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
 * Public export — the downloader uses the same UA to avoid getting 403'd
 * when pulling ZIPs from the same CDN.
 */
export const MOJMAP_HTTP_HEADERS = HTTP_HEADERS;

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
