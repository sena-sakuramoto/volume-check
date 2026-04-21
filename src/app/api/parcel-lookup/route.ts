import { NextRequest, NextResponse } from 'next/server';
import { PMTiles } from 'pmtiles';
import { featureGeometryToLatLng, latLngToPixel, latLngToTile, pointInFeatureGeometry } from '@/lib/mvt-utils';
import { parseRequestLatLng } from '@/lib/coordinate-parser';

/**
 * parcel-lookup — resolve the 筆界 (parcel boundary) that contains or is
 * closest to a given lat/lng. Lookup order:
 *
 *   1. 法務省 登記所備付地図 PMTiles (MOJ)  — highest trust, legal basis.
 *      Resolved via `current.txt` on GCS so the build pipeline can atomically
 *      swap versions without touching API code.
 *   2. 農研機構 AMX PMTiles                — broad national coverage but
 *      農地-heavy, sparse in urban cores.
 *
 * Either layer can be empty / unavailable without failing the request — the
 * store falls back to OSM building footprint estimation (`/api/nearby-buildings`)
 * and ultimately to manual draw.
 *
 * Both PMTiles are expected to publish a layer named `fude` so the same
 * VectorTile / pointInFeatureGeometry code handles them. The build pipeline
 * embeds `source: 'moj' | 'amx'` on each feature's properties and this route
 * also defensively sets it on every candidate so downstream code can trust it.
 */

const MOJ_CURRENT_URL =
  process.env.MOJ_CURRENT_URL ??
  'https://storage.googleapis.com/volans-web-parcel-data/moj/current.txt';
const MOJ_BUCKET_BASE =
  process.env.MOJ_BUCKET_BASE ??
  'https://storage.googleapis.com/volans-web-parcel-data';
const AMX_PMTILES_URL = 'https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles';

const ZOOM_LEVEL = 15;
const SEARCH_TILE_RANGE = 1;
const MAX_CANDIDATES = 10;
const EARTH_RADIUS = 6378137;
const MAX_NEARBY_DISTANCE_METERS = 200;
const MOJ_RESOLVE_TTL_MS = 10 * 60 * 1000; // cache current.txt for 10 minutes

type ParcelCandidate = {
  properties: Record<string, unknown>;
  coordinates: [number, number][][];
  containsPoint: boolean;
  distanceMeters: number;
  source: 'moj' | 'amx';
};

type ParcelFeatureCandidate = {
  feature: {
    properties: Record<string, unknown>;
    extent: number;
    loadGeometry: () => Array<Array<{ x: number; y: number }>>;
  };
  tileX: number;
  tileY: number;
  containsPoint: boolean;
  distancePx: number;
  extent: number;
};

let amxPmtiles: PMTiles | null = null;
let mojPmtiles: PMTiles | null = null;
let mojObjectKey: string | null = null;
let mojResolvedAt = 0;

function getAmxPmtiles(): PMTiles {
  if (!amxPmtiles) {
    amxPmtiles = new PMTiles(AMX_PMTILES_URL);
  }
  return amxPmtiles;
}

/**
 * Resolve the current MOJ PMTiles object via `current.txt`. The text file
 * contains a single bucket-relative object key (e.g. `moj/mojmap-20260421-030500.pmtiles`).
 * The resolved PMTiles client is memoised until MOJ_RESOLVE_TTL_MS elapses or
 * the key changes, so we avoid hammering GCS on every request.
 *
 * Returns null when the pointer is missing, malformed, or the fetch fails —
 * callers must treat null as "MOJ unavailable" and fall back to AMX.
 */
async function getMojPmtiles(): Promise<PMTiles | null> {
  const now = Date.now();
  if (mojPmtiles && now - mojResolvedAt < MOJ_RESOLVE_TTL_MS) {
    return mojPmtiles;
  }
  try {
    const resp = await fetch(MOJ_CURRENT_URL, { cache: 'no-store' });
    if (!resp.ok) {
      return null;
    }
    const key = (await resp.text()).trim();
    if (!key || !key.startsWith('moj/') || !key.endsWith('.pmtiles')) {
      return null;
    }
    if (key === mojObjectKey && mojPmtiles) {
      mojResolvedAt = now;
      return mojPmtiles;
    }
    mojObjectKey = key;
    mojPmtiles = new PMTiles(`${MOJ_BUCKET_BASE.replace(/\/$/, '')}/${key}`);
    mojResolvedAt = now;
    return mojPmtiles;
  } catch (err) {
    console.warn('[parcel-lookup] MOJ current.txt resolve failed:', err);
    return null;
  }
}

function metersPerPixel(lat: number, z: number, extent: number): number {
  const latRad = (lat * Math.PI) / 180;
  const worldPixels = Math.pow(2, z) * extent;
  return (Math.cos(latRad) * 2 * Math.PI * EARTH_RADIUS) / worldPixels;
}

function calcFeatureCenterDistancePx(
  feature: ParcelFeatureCandidate['feature'],
  pixelX: number,
  pixelY: number,
): number {
  const geometry = feature.loadGeometry();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of geometry) {
    for (const point of ring) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return Number.POSITIVE_INFINITY;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const dx = centerX - pixelX;
  const dy = centerY - pixelY;
  return Math.hypot(dx, dy);
}

async function readTileFeatures(
  pm: PMTiles,
  z: number,
  tileX: number,
  tileY: number,
): Promise<{
  features: ParcelFeatureCandidate[];
  extent: number | null;
}> {
  const tileData = await pm.getZxy(z, tileX, tileY);
  if (!tileData?.data || tileData.data.byteLength === 0) {
    return { features: [], extent: null };
  }

  const Pbf = (await import('pbf')).default;
  const { VectorTile } = await import('@mapbox/vector-tile');
  const tile = new VectorTile(new Pbf(new Uint8Array(tileData.data)));
  const fudeLayer = tile.layers.fude;
  if (!fudeLayer || fudeLayer.length === 0) {
    return { features: [], extent: null };
  }

  const extent = fudeLayer.feature(0).extent;
  const features: ParcelFeatureCandidate[] = [];
  for (let i = 0; i < fudeLayer.length; i++) {
    const feature = fudeLayer.feature(i) as ParcelFeatureCandidate['feature'];
    features.push({
      feature,
      tileX,
      tileY,
      containsPoint: false,
      distancePx: Number.POSITIVE_INFINITY,
      extent,
    });
  }
  return { features, extent };
}

/**
 * Probe a single PMTiles source at (lat, lng) and return normalised parcel
 * candidates. Returns [] silently when the layer has no data or the tile is
 * outside the published bounds — never throws on "nothing here".
 */
async function lookupFromPmtiles(
  pm: PMTiles,
  source: 'moj' | 'amx',
  lat: number,
  lng: number,
): Promise<ParcelCandidate[]> {
  const z = ZOOM_LEVEL;
  const { tileX, tileY } = latLngToTile(lat, lng, z);
  const allCandidates: ParcelFeatureCandidate[] = [];
  let hasTileData = false;

  for (let dx = -SEARCH_TILE_RANGE; dx <= SEARCH_TILE_RANGE; dx++) {
    for (let dy = -SEARCH_TILE_RANGE; dy <= SEARCH_TILE_RANGE; dy++) {
      const tx = tileX + dx;
      const ty = tileY + dy;
      if (tx < 0 || ty < 0) continue;

      let tileResult: { features: ParcelFeatureCandidate[]; extent: number | null };
      try {
        tileResult = await readTileFeatures(pm, z, tx, ty);
      } catch (err) {
        // Treat per-tile read failures as "no data here" so a single flaky
        // range request does not kill the whole lookup. Log once per tile.
        console.warn(`[parcel-lookup] ${source} tile ${z}/${tx}/${ty} read failed:`, err);
        continue;
      }
      if (tileResult.features.length === 0 || !tileResult.extent) continue;
      hasTileData = true;

      const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tx, ty, tileResult.extent);
      for (const candidate of tileResult.features) {
        candidate.containsPoint = pointInFeatureGeometry(pixelX, pixelY, candidate.feature);
        candidate.distancePx = candidate.containsPoint
          ? 0
          : calcFeatureCenterDistancePx(candidate.feature, pixelX, pixelY);
        allCandidates.push(candidate);
      }
    }
  }

  if (!hasTileData || allCandidates.length === 0) {
    return [];
  }

  allCandidates.sort((a, b) => {
    if (a.containsPoint !== b.containsPoint) {
      return Number(b.containsPoint) - Number(a.containsPoint);
    }
    return a.distancePx - b.distancePx;
  });

  const seenKeys = new Set<string>();
  const pixelsToMeters = metersPerPixel(lat, z, allCandidates[0]?.extent ?? 4096);
  const candidates: ParcelCandidate[] = [];
  for (const candidate of allCandidates) {
    if (candidates.length >= MAX_CANDIDATES) break;
    const props = candidate.feature.properties as Record<string, unknown>;
    const chiban = String(props['地番'] ?? props.chiban ?? '');
    const dedupeKey = `${chiban}:${candidate.tileX}:${candidate.tileY}:${Math.round(candidate.distancePx)}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    // Defensive source tag — trust the upstream property when present and
    // consistent, otherwise overwrite with the caller's declared source.
    const upstreamSource = props.source;
    const resolvedSource: 'moj' | 'amx' =
      upstreamSource === 'moj' || upstreamSource === 'amx' ? upstreamSource : source;

    candidates.push({
      properties: { ...props, source: resolvedSource },
      coordinates: featureGeometryToLatLng(candidate.feature, z, candidate.tileX, candidate.tileY),
      containsPoint: candidate.containsPoint,
      distanceMeters: Number.isFinite(candidate.distancePx)
        ? candidate.distancePx * pixelsToMeters
        : Number.POSITIVE_INFINITY,
      source: resolvedSource,
    });
  }

  return candidates;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lat: unknown; lng: unknown };
    const parsed = parseRequestLatLng(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { lat, lng } = parsed;

    let candidates: ParcelCandidate[] = [];
    const moj = await getMojPmtiles();
    if (moj) {
      try {
        candidates = await lookupFromPmtiles(moj, 'moj', lat, lng);
      } catch (err) {
        console.warn('[parcel-lookup] MOJ lookup threw, falling back to AMX:', err);
      }
    }

    if (candidates.length === 0) {
      try {
        candidates = await lookupFromPmtiles(getAmxPmtiles(), 'amx', lat, lng);
      } catch (err) {
        console.warn('[parcel-lookup] AMX lookup threw:', err);
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の筆界データがありません。手動入力をご利用ください。',
      });
    }

    const hasContainingParcel = candidates.some((candidate) => candidate.containsPoint);
    const nearbyCandidates = hasContainingParcel
      ? candidates
      : candidates.filter((candidate) => candidate.distanceMeters <= MAX_NEARBY_DISTANCE_METERS);

    if (!hasContainingParcel && nearbyCandidates.length === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の近傍に利用可能な筆界データがありません。手動入力をご利用ください。',
      });
    }

    const message = hasContainingParcel
      ? undefined
      : '該当地点の筆界が見つからないため、近傍候補を表示しています。';

    return NextResponse.json({
      parcels: nearbyCandidates.map((candidate) => ({
        chiban: candidate.properties['地番'] ?? candidate.properties.chiban ?? '不明',
        oaza: candidate.properties['大字名'] ?? '',
        chome: candidate.properties['丁目名'] ?? '',
        koaza: candidate.properties['小字名'] ?? '',
        coordinates: candidate.coordinates,
        containsPoint: candidate.containsPoint,
        distanceMeters: Number.isFinite(candidate.distanceMeters)
          ? Math.round(candidate.distanceMeters * 10) / 10
          : null,
        properties: candidate.properties,
      })),
      ...(message ? { message } : {}),
    });
  } catch (error) {
    console.error('[parcel-lookup] Error:', error);
    return NextResponse.json({ error: 'パーセル検索に失敗しました' }, { status: 500 });
  }
}

// Internal exports for unit tests — do not rely on these from route callers.
export const __testing = {
  resetCaches() {
    amxPmtiles = null;
    mojPmtiles = null;
    mojObjectKey = null;
    mojResolvedAt = 0;
  },
  getMojPmtiles,
  lookupFromPmtiles,
};
