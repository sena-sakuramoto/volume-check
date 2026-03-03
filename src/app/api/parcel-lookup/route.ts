import { NextRequest, NextResponse } from 'next/server';
import { PMTiles } from 'pmtiles';
import { featureGeometryToLatLng, latLngToPixel, latLngToTile, pointInFeatureGeometry } from '@/lib/mvt-utils';

const AMX_PMTILES_URL = 'https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles';

type ParcelCandidate = {
  properties: Record<string, unknown>;
  coordinates: [number, number][][];
  containsPoint: boolean;
};

let pmtilesInstance: PMTiles | null = null;

function getPMTiles(): PMTiles {
  if (!pmtilesInstance) {
    pmtilesInstance = new PMTiles(AMX_PMTILES_URL);
  }
  return pmtilesInstance;
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lng } = (await req.json()) as { lat: unknown; lng: unknown };

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: '緯度(lat)と経度(lng)を数値で指定してください' },
        { status: 400 },
      );
    }

    const z = 15;
    const { tileX, tileY } = latLngToTile(lat, lng, z);
    const pm = getPMTiles();
    const tileData = await pm.getZxy(z, tileX, tileY);

    if (!tileData?.data || tileData.data.byteLength === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の筆界データがありません。手動入力をご利用ください。',
      });
    }

    const Pbf = (await import('pbf')).default;
    const { VectorTile } = await import('@mapbox/vector-tile');
    const tile = new VectorTile(new Pbf(new Uint8Array(tileData.data)));

    const fudeLayer = tile.layers.fude;
    if (!fudeLayer || fudeLayer.length === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の筆界データがありません。',
      });
    }

    const extent = fudeLayer.feature(0).extent;
    const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);

    const candidates: ParcelCandidate[] = [];
    for (let i = 0; i < fudeLayer.length; i++) {
      const feature = fudeLayer.feature(i);
      const containsPoint = pointInFeatureGeometry(pixelX, pixelY, feature);

      if (containsPoint || candidates.length < 10) {
        candidates.push({
          properties: feature.properties as Record<string, unknown>,
          coordinates: featureGeometryToLatLng(feature, z, tileX, tileY),
          containsPoint,
        });
      }

      if (containsPoint && candidates.length >= 5) {
        break;
      }
    }

    candidates.sort((a, b) => Number(b.containsPoint) - Number(a.containsPoint));

    return NextResponse.json({
      parcels: candidates.slice(0, 10).map((candidate) => ({
        chiban: candidate.properties['地番'] ?? candidate.properties.chiban ?? '不明',
        oaza: candidate.properties['大字名'] ?? '',
        chome: candidate.properties['丁目名'] ?? '',
        koaza: candidate.properties['小字名'] ?? '',
        coordinates: candidate.coordinates,
        containsPoint: candidate.containsPoint,
        properties: candidate.properties,
      })),
    });
  } catch (error) {
    console.error('[parcel-lookup] Error:', error);
    return NextResponse.json({ error: 'パーセル検索に失敗しました' }, { status: 500 });
  }
}
