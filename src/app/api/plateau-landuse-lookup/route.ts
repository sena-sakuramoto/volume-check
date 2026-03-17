import { NextRequest, NextResponse } from 'next/server';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { buildSiteFromGeoRing, inferDefaultRoadFromVertices } from '@/lib/site-shape';
import {
  featureGeometryToLatLng,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';
import { fetchZipEntry } from '@/lib/remote-zip';
import { parseRequestLatLng } from '@/lib/coordinate-parser';

const TOKYO23_LANDUSE_ZIP_URL =
  'https://gic-plateau.s3.ap-northeast-1.amazonaws.com/2020/13100_tokyo23ku_2020_3Dtiles_etc_1_op.zip';
const TOKYO23_LANDUSE_PREFIX =
  '13100_tokyo23ku_2020_3Dtiles_etc_1_op/07_landuse/13100_tokyo23ku_2020_luse';
const TILE_ZOOM = 14;
const NEARBY_PIXEL_THRESHOLD = 768;

function pickOuterRing(rings: [number, number][][]): [number, number][] | null {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  let best: [number, number][] | null = null;
  let bestArea = -1;

  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const area = computeRingArea(ring);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }

  return best;
}

function computeRingArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(area) / 2;
}

function computeFeaturePixelDistance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any,
  pixelX: number,
  pixelY: number,
): number {
  const geometry = feature.loadGeometry() as Array<Array<{ x: number; y: number }>>;
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

  const dx = Math.max(minX - pixelX, 0, pixelX - maxX);
  const dy = Math.max(minY - pixelY, 0, pixelY - maxY);
  return Math.hypot(dx, dy);
}

type LanduseCandidate = {
  ring: [number, number][];
  area: number;
  distance: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any;
};

function pickBestCandidate(
  containingCandidates: LanduseCandidate[],
  nearbyCandidates: LanduseCandidate[],
): LanduseCandidate | null {
  if (containingCandidates.length > 0) {
    return [...containingCandidates].sort((a, b) => a.area - b.area)[0];
  }
  if (nearbyCandidates.length > 0) {
    return [...nearbyCandidates].sort((a, b) => a.distance - b.distance || a.area - b.area)[0];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lat: unknown; lng: unknown };
    const parsed = parseRequestLatLng(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { lat, lng } = parsed;

    const { tileX, tileY } = latLngToTile(lat, lng, TILE_ZOOM);
    const entryPath = `${TOKYO23_LANDUSE_PREFIX}/${TILE_ZOOM}/${tileX}/${tileY}.mvt`;
    const bytes = await fetchZipEntry(TOKYO23_LANDUSE_ZIP_URL, entryPath);
    if (!bytes) {
      return NextResponse.json({ error: 'PLATEAU土地利用タイルが見つかりませんでした' }, { status: 404 });
    }

    const tile = new VectorTile(new Pbf(bytes));
    const layers = Object.entries(tile.layers).filter(([, layer]) => layer.length > 0);
    if (layers.length === 0) {
      return NextResponse.json({ error: 'PLATEAU土地利用タイルが空です' }, { status: 404 });
    }

    const extent = layers[0][1].feature(0).extent;
    const { pixelX, pixelY } = latLngToPixel(lat, lng, TILE_ZOOM, tileX, tileY, extent);
    const containingCandidates: LanduseCandidate[] = [];
    const nearbyCandidates: LanduseCandidate[] = [];

    for (const [, layer] of layers) {
      for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        const rings = featureGeometryToLatLng(feature, TILE_ZOOM, tileX, tileY);
        const ring = pickOuterRing(rings);
        if (!ring) continue;

        const area = computeRingArea(ring);
        const distance = computeFeaturePixelDistance(feature, pixelX, pixelY);
        const candidate = {
          ring,
          area,
          distance,
          properties: feature.properties,
        };

        if (pointInFeatureGeometry(pixelX, pixelY, feature)) {
          containingCandidates.push(candidate);
          continue;
        }

        if (distance <= NEARBY_PIXEL_THRESHOLD) {
          nearbyCandidates.push(candidate);
        }
      }
    }

    const selectedCandidate = pickBestCandidate(containingCandidates, nearbyCandidates);
    if (!selectedCandidate) {
      return NextResponse.json({ error: 'PLATEAU土地利用形状が見つかりませんでした' }, { status: 404 });
    }

    const geoRing = selectedCandidate.ring.map(([pointLng, pointLat]) => ({
      lat: pointLat,
      lng: pointLng,
    }));
    const site = buildSiteFromGeoRing(geoRing);
    if (!site) {
      return NextResponse.json({ error: 'PLATEAU土地利用形状を敷地へ変換できませんでした' }, { status: 422 });
    }

    const road = inferDefaultRoadFromVertices(site.vertices, 6);
    return NextResponse.json({
      site,
      roads: road ? [road] : [],
      siteCoordinates: selectedCandidate.ring,
      source: 'plateau-landuse',
      attributes: selectedCandidate.properties,
      matchMode: containingCandidates.length > 0 ? 'contains' : 'nearby',
    });
  } catch (error) {
    console.error('[plateau-landuse-lookup] Error:', error);
    return NextResponse.json(
      { error: 'PLATEAU土地利用形状の取得に失敗しました' },
      { status: 500 },
    );
  }
}
