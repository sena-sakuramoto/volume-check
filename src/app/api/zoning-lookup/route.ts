import { NextRequest, NextResponse } from 'next/server';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

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
// Tile coordinate helpers
// ---------------------------------------------------------------------------

function latLngToTile(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const tileX = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { tileX, tileY };
}

function latLngToPixel(
  lat: number,
  lng: number,
  z: number,
  tileX: number,
  tileY: number,
  extent: number
) {
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const pixelX = ((lng + 180) / 360 * n - tileX) * extent;
  const pixelY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - tileY) *
    extent;
  return { pixelX, pixelY };
}
// ---------------------------------------------------------------------------
// Ray-casting point-in-polygon
// ---------------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

function pointInPolygon(px: number, py: number, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if a point is inside a feature geometry (handles Polygon and
 * MultiPolygon by testing outer rings and subtracting inner rings).
 */
function pointInFeatureGeometry(
  px: number,
  py: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any
): boolean {
  const geomType = feature.type;
  const geometry: Point[][] = feature.loadGeometry();

  if (geomType === 3) {
    let insideOuter = false;
    let insideHole = false;

    for (const ring of geometry) {
      const area = signedArea(ring);
      if (area > 0) {
        if (insideOuter && !insideHole) return true;
        insideOuter = pointInPolygon(px, py, ring);
        insideHole = false;
      } else {
        if (insideOuter && pointInPolygon(px, py, ring)) {
          insideHole = true;
        }
      }
    }

    return insideOuter && !insideHole;
  }

  if (geomType === 1) {
    for (const ring of geometry) {
      for (const pt of ring) {
        const dx = pt.x - px;
        const dy = pt.y - py;
        if (dx * dx + dy * dy < 100) return true;
      }
    }
  }

  return false;
}

function signedArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  }
  return sum;
}
// ---------------------------------------------------------------------------
// Property extraction helpers
// ---------------------------------------------------------------------------

const DISTRICT_KEYS = [
  '用途地域', 'use_area_ja', 'youto', 'youto_chiiki',
  'A29_004', 'A29_005', 'name', 'district', 'zone',
  '用途地域名', 'use_district',
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
// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: '緯度(lat)と経度(lng)は数値で指定してください' },
        { status: 400 }
      );
    }

    // Try zoom level 15 first, then fall back to 14
    const zoomLevels = [15, 14];

    for (const z of zoomLevels) {
      const result = await tryFetchZoning(lat, lng, z);
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
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
async function tryFetchZoning(
  lat: number,
  lng: number,
  z: number
): Promise<{
  district: string;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
} | null> {
  const { tileX, tileY } = latLngToTile(lat, lng, z);

  const url = TILE_URL_TEMPLATE
    .replace('{z}', String(z))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));

  console.log(`[zoning-lookup] Fetching tile z=${z} x=${tileX} y=${tileY}: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    console.warn(
      `[zoning-lookup] Tile fetch failed: ${response.status} ${response.statusText}`
    );
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const pbf = new Pbf(new Uint8Array(arrayBuffer));
  const tile = new VectorTile(pbf);

  const layerNames = Object.keys(tile.layers);
  console.log(`[zoning-lookup] Available layers: ${layerNames.join(', ')}`);

  if (layerNames.length === 0) {
    console.warn('[zoning-lookup] No layers found in tile');
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
  console.log(`[zoning-lookup] Using layer "${layerName}" with ${layer.length} features`);

  if (layer.length === 0) {
    return null;
  }

  // Log properties of first feature for debugging
  const debugFeature = layer.feature(0);
  const debugProps = debugFeature.properties;
  console.log(
    '[zoning-lookup] First feature properties:',
    JSON.stringify(debugProps, null, 2)
  );

  const extent = debugFeature.extent;
  const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);

  console.log(
    `[zoning-lookup] Point in tile coords: pixelX=${pixelX.toFixed(1)}, pixelY=${pixelY.toFixed(1)}, extent=${extent}`
  );

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);

    if (pointInFeatureGeometry(pixelX, pixelY, feature)) {
      const props = feature.properties as Record<string, unknown>;

      console.log(
        `[zoning-lookup] Matched feature ${i} properties:`,
        JSON.stringify(props, null, 2)
      );

      const districtRaw = findProperty(props, DISTRICT_KEYS);
      const coverageRaw = findProperty(props, COVERAGE_KEYS);
      const farRaw = findProperty(props, FAR_KEYS);
      const fireRaw = findProperty(props, FIRE_KEYS);

      const district = districtRaw ? String(districtRaw) : '不明';
      const coverageRatio = parseNumericValue(coverageRaw) ?? 0;
      const floorAreaRatio = parseNumericValue(farRaw) ?? 0;
      const fireDistrict = fireRaw ? String(fireRaw) : '指定なし';

      return {
        district,
        coverageRatio,
        floorAreaRatio,
        fireDistrict,
      };
    }
  }

  console.log(`[zoning-lookup] No feature matched at z=${z}`);
  return null;
}
