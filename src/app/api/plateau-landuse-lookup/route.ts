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

function pickOuterRing(rings: [number, number][][]): [number, number][] | null {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  let best: [number, number][] | null = null;
  let bestArea = -1;

  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
    }
    const absArea = Math.abs(area) / 2;
    if (absArea > bestArea) {
      bestArea = absArea;
      best = ring;
    }
  }

  return best;
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
    const layerName = Object.keys(tile.layers)[0];
    const layer = layerName ? tile.layers[layerName] : null;
    if (!layer || layer.length === 0) {
      return NextResponse.json({ error: 'PLATEAU土地利用タイルが空です' }, { status: 404 });
    }

    const extent = layer.feature(0).extent;
    const { pixelX, pixelY } = latLngToPixel(lat, lng, TILE_ZOOM, tileX, tileY, extent);

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      if (!pointInFeatureGeometry(pixelX, pixelY, feature)) continue;

      const rings = featureGeometryToLatLng(feature, TILE_ZOOM, tileX, tileY);
      const ring = pickOuterRing(rings);
      if (!ring) continue;

      const geoRing = ring.map(([pointLng, pointLat]) => ({ lat: pointLat, lng: pointLng }));
      const site = buildSiteFromGeoRing(geoRing);
      if (!site) continue;

      const road = inferDefaultRoadFromVertices(site.vertices, 6);
      return NextResponse.json({
        site,
        roads: road ? [road] : [],
        siteCoordinates: ring,
        source: 'plateau-landuse',
        attributes: feature.properties,
      });
    }

    return NextResponse.json({ error: 'PLATEAU土地利用形状が見つかりませんでした' }, { status: 404 });
  } catch (error) {
    console.error('[plateau-landuse-lookup] Error:', error);
    return NextResponse.json(
      { error: 'PLATEAU土地利用形状の取得に失敗しました' },
      { status: 500 },
    );
  }
}
