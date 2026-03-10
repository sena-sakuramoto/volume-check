import { NextRequest, NextResponse } from 'next/server';
import {
  fetchMvtTile,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';
import { parseRequestLatLng } from '@/lib/coordinate-parser';
import {
  aggregateDistrictsFromSampling,
  pickDominantDistrict,
  type DistrictSample,
  type TilePoint,
} from '@/lib/zoning-aggregation';

/**
 * Look up zoning data for a given lat/lng by fetching a PBF vector tile
 * from the Geolonia CloudFront proxy and performing point-in-polygon tests.
 *
 * POST body: { lat: number, lng: number }
 * Response:  { district: string, coverageRatio: number, floorAreaRatio: number, fireDistrict: string }
 *         or { error: string }
 */

const TILE_URL_TEMPLATE =
  'https://du6jhqfvlioa4.cloudfront.net/ex-api/external/XKT002/{z}/{x}/{y}.pbf';

// ---------------------------------------------------------------------------
// Property extraction helpers
// ---------------------------------------------------------------------------

const DISTRICT_KEYS = [
  '用途地域', 'use_area_ja', 'youto', 'youto_chiiki',
  'A29_004', 'A29_005', 'name', 'district', 'zone',
  '用途地域名', 'use_district', '用途地域コード', 'use_district_code',
];

const COVERAGE_KEYS = [
  '建ぺい率', '建蔽率', 'u_building_coverage_ratio_ja',
  'kenpei', 'kenpeiritsu', 'building_coverage_ratio',
  'A29_009', 'coverage_ratio', 'bcr',
];

const FAR_KEYS = [
  '容積率', 'u_floor_area_ratio_ja', 'youseki', 'yousekiritsu',
  'floor_area_ratio', 'A29_010', 'far',
];

const FIRE_KEYS = [
  '防火地域', '防火・準防火', 'fire_district', 'fire_area',
  'bouka', 'A29_012', 'fire_prevention_district',
];

function findProperty(
  properties: Record<string, unknown>,
  keys: string[]
): string | number | undefined {
  for (const key of keys) {
    if (properties[key] !== undefined && properties[key] !== null && properties[key] !== '') {
      return properties[key] as string | number;
    }
  }
  return undefined;
}

function parseNumericValue(val: string | number | undefined): number | undefined {
  if (val === undefined) return undefined;
  if (typeof val === 'number') return val;
  const match = String(val).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : undefined;
}

const DISTRICT_CODE_TO_NAME: Record<string, string> = {
  '1': '第一種低層住居専用地域',
  '01': '第一種低層住居専用地域',
  '2': '第二種低層住居専用地域',
  '02': '第二種低層住居専用地域',
  '3': '第一種中高層住居専用地域',
  '03': '第一種中高層住居専用地域',
  '4': '第二種中高層住居専用地域',
  '04': '第二種中高層住居専用地域',
  '5': '第一種住居地域',
  '05': '第一種住居地域',
  '6': '第二種住居地域',
  '06': '第二種住居地域',
  '7': '準住居地域',
  '07': '準住居地域',
  '8': '田園住居地域',
  '08': '田園住居地域',
  '9': '近隣商業地域',
  '09': '近隣商業地域',
  '10': '商業地域',
  '11': '準工業地域',
  '12': '工業地域',
  '13': '工業専用地域',
};

function normalizeDistrictValue(val: string | number | undefined): string | undefined {
  if (val === undefined) return undefined;
  const raw = String(val).trim();
  if (!raw) return undefined;

  const compact = raw
    .replace(/[ \t　]/g, '')
    .replace(/[()（）]/g, '')
    .replace(/第?1種/g, '第一種')
    .replace(/第?2種/g, '第二種')
    .replace(/第?3種/g, '第三種');

  if (DISTRICT_CODE_TO_NAME[compact]) return DISTRICT_CODE_TO_NAME[compact];

  const codeMatch = compact.match(/(?:用途地域コード|コード|code|zone)?[:：=]?([0-9]{1,2})$/i);
  if (codeMatch) {
    const code = codeMatch[1];
    if (DISTRICT_CODE_TO_NAME[code]) return DISTRICT_CODE_TO_NAME[code];
    const padded = code.padStart(2, '0');
    if (DISTRICT_CODE_TO_NAME[padded]) return DISTRICT_CODE_TO_NAME[padded];
  }

  return compact;
}
// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const DEBUG = process.env.NODE_ENV === 'development';

type ZoningLookupResult = {
  district: string;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
  districts?: Array<{
    district: string;
    ratio: number;
    coverageRatio: number;
    floorAreaRatio: number;
    fireDistrict: string;
  }>;
};

function parseSiteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const points: [number, number][] = [];

  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const [lng, lat] = item;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    points.push([lng, lat]);
  }

  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12;
  if (isClosed) points.pop();

  return points.length >= 3 ? points : null;
}

function parseFeatureDistrictSample(props: Record<string, unknown>): DistrictSample | null {
  const districtRaw = findProperty(props, DISTRICT_KEYS);
  const district = normalizeDistrictValue(districtRaw);
  if (!district) return null;

  const coverageRaw = findProperty(props, COVERAGE_KEYS);
  const farRaw = findProperty(props, FAR_KEYS);
  const fireRaw = findProperty(props, FIRE_KEYS);

  return {
    district,
    coverageRatio: parseNumericValue(coverageRaw) ?? 0,
    floorAreaRatio: parseNumericValue(farRaw) ?? 0,
    fireDistrict: fireRaw ? String(fireRaw) : '指定なし',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = parseRequestLatLng({ lat: body?.lat, lng: body?.lng });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { lat, lng } = parsed;
    const siteCoordinates = parseSiteCoordinates(body?.siteCoordinates);

    // Try zoom level 15 first, then fall back to 14
    const zoomLevels = [15, 14];

    for (const z of zoomLevels) {
      const result = await tryFetchZoning(lat, lng, z, siteCoordinates);
      if (result) {
        return NextResponse.json(result);
      }
    }

    return NextResponse.json(
      { error: '指定された座標の用途地域データが見つかりませんでした' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Zoning lookup API error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'リクエストボディのJSON形式が不正です' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
async function tryFetchZoning(
  lat: number,
  lng: number,
  z: number,
  siteCoordinates: [number, number][] | null,
): Promise<ZoningLookupResult | null> {
  const { tileX, tileY } = latLngToTile(lat, lng, z);

  const url = TILE_URL_TEMPLATE
    .replace('{z}', String(z))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));

  if (DEBUG) console.log(`[zoning-lookup] Fetching tile z=${z} x=${tileX} y=${tileY}: ${url}`);

  const tile = await fetchMvtTile(TILE_URL_TEMPLATE, z, tileX, tileY);
  if (!tile) {
    if (DEBUG) console.warn('[zoning-lookup] Failed to fetch/parse tile');
    return null;
  }

  const layerNames = Object.keys(tile.layers);
  if (DEBUG) console.log(`[zoning-lookup] Available layers: ${layerNames.join(', ')}`);

  if (layerNames.length === 0) {
    if (DEBUG) console.warn('[zoning-lookup] No layers found in tile');
    return null;
  }

  const preferredLayers = ['hits', 'youto', 'zoning', 'use_district', 'A29'];
  let layerName = layerNames[0];
  for (const preferred of preferredLayers) {
    if (layerNames.includes(preferred)) {
      layerName = preferred;
      break;
    }
  }

  const layer = tile.layers[layerName];
  if (DEBUG) console.log(`[zoning-lookup] Using layer "${layerName}" with ${layer.length} features`);

  if (layer.length === 0) {
    return null;
  }

  const debugFeature = layer.feature(0);
  if (DEBUG) {
    console.log('[zoning-lookup] First feature properties:', JSON.stringify(debugFeature.properties, null, 2));
  }

  const extent = debugFeature.extent;
  const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);
  const features = Array.from({ length: layer.length }, (_, i) => layer.feature(i));

  if (DEBUG) {
    console.log(`[zoning-lookup] Point in tile coords: pixelX=${pixelX.toFixed(1)}, pixelY=${pixelY.toFixed(1)}, extent=${extent}`);
  }

  let pointResult: ZoningLookupResult | null = null;
  for (let i = 0; i < features.length; i++) {
    const feature = features[i];

    if (pointInFeatureGeometry(pixelX, pixelY, feature)) {
      const props = feature.properties as Record<string, unknown>;

      if (DEBUG) console.log(`[zoning-lookup] Matched feature ${i}:`, JSON.stringify(props, null, 2));

      const sample = parseFeatureDistrictSample(props);
      if (sample) {
        pointResult = {
          district: sample.district,
          coverageRatio: sample.coverageRatio,
          floorAreaRatio: sample.floorAreaRatio,
          fireDistrict: sample.fireDistrict,
        };
      }
      break;
    }
  }

  if (siteCoordinates && siteCoordinates.length >= 3) {
    const sitePixels: TilePoint[] = siteCoordinates.map(([siteLng, siteLat]) => {
      const { pixelX: siteX, pixelY: siteY } = latLngToPixel(siteLat, siteLng, z, tileX, tileY, extent);
      return { x: siteX, y: siteY };
    });

    const minX = Math.min(...sitePixels.map((p) => p.x));
    const maxX = Math.max(...sitePixels.map((p) => p.x));
    const minY = Math.min(...sitePixels.map((p) => p.y));
    const maxY = Math.max(...sitePixels.map((p) => p.y));
    const bboxArea = Math.max(1, (maxX - minX) * (maxY - minY));
    const step = Math.max(2, Math.floor(Math.sqrt(bboxArea / 1600)));

    const districts = aggregateDistrictsFromSampling(
      sitePixels,
      (x, y) => {
        for (const feature of features) {
          if (!pointInFeatureGeometry(x, y, feature)) continue;
          const props = feature.properties as Record<string, unknown>;
          return parseFeatureDistrictSample(props);
        }
        return null;
      },
      { step },
    );

    const dominant = pickDominantDistrict(districts);
    if (dominant) {
      return {
        district: dominant.district,
        coverageRatio: dominant.coverageRatio,
        floorAreaRatio: dominant.floorAreaRatio,
        fireDistrict: dominant.fireDistrict,
        districts,
      };
    }
  }

  if (pointResult) return pointResult;

  if (DEBUG) console.log(`[zoning-lookup] No feature matched at z=${z}`);
  return null;
}
