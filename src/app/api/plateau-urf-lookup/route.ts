import { NextRequest, NextResponse } from 'next/server';
import { fetchMvtTile, latLngToPixel, latLngToTile, pointInFeatureGeometry } from '@/lib/mvt-utils';
import { parseRequestLatLng } from '@/lib/coordinate-parser';

const TILE_URLS = {
  heightControl:
    'https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
  firePrevention:
    'https://assets.cms.plateau.reearth.io/assets/d9/5ce2d6-0aa8-4a17-a86a-028c2dc2b817/13_tokyo_pref_2023_citygml_1_op_urf_FirePreventionDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
  useDistrict:
    'https://assets.cms.plateau.reearth.io/assets/5b/8d0e14-be51-4739-bf91-13cc176472c8/13_tokyo_pref_2023_citygml_1_op_urf_UseDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
};

interface PlateauUrfResult {
  heightDistrict: {
    type: string;
    maxHeight?: number;
    slopeRatio?: number;
    attributes?: Record<string, unknown>;
  } | null;
  fireDistrict: {
    type: string;
    attributes?: Record<string, unknown>;
  } | null;
  districtPlan: {
    name: string;
    restrictions?: string;
    maxHeight?: number;
    minHeight?: number;
    wallSetback?: number;
    floorAreaRatio?: number;
    coverageRatio?: number;
    attributes?: Record<string, unknown>;
  } | null;
  useDistrict: {
    floorAreaRatio?: number;
    coverageRatio?: number;
    district?: string;
    attributes?: Record<string, unknown>;
  } | null;
}

function parseAttributes(props: Record<string, unknown>): Record<string, unknown> {
  const attrStr = props.attributes;
  if (typeof attrStr === 'string') {
    try {
      return JSON.parse(attrStr) as Record<string, unknown>;
    } catch {
      return props;
    }
  }
  return props;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function asRatio(value: unknown): number | undefined {
  const num = asNumber(value);
  if (num === undefined) return undefined;
  return num > 1 ? num / 100 : num;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

async function queryTileAtPoint(
  urlTemplate: string,
  lat: number,
  lng: number,
  z: number,
  layerName?: string,
): Promise<{ properties: Record<string, unknown>; attributes: Record<string, unknown> } | null> {
  const { tileX, tileY } = latLngToTile(lat, lng, z);
  const tile = await fetchMvtTile(urlTemplate, z, tileX, tileY);
  if (!tile) return null;

  const layerNames = Object.keys(tile.layers);
  const targetLayer = layerName ? tile.layers[layerName] : tile.layers[layerNames[0]];
  if (!targetLayer || targetLayer.length === 0) return null;

  const extent = targetLayer.feature(0).extent;
  const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);

  for (let i = 0; i < targetLayer.length; i++) {
    const feature = targetLayer.feature(i);
    if (pointInFeatureGeometry(pixelX, pixelY, feature)) {
      const props = feature.properties as Record<string, unknown>;
      return { properties: props, attributes: parseAttributes(props) };
    }
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

    const z = 14;
    const [heightResult, fireResult, useResult] = await Promise.allSettled([
      queryTileAtPoint(TILE_URLS.heightControl, lat, lng, z),
      queryTileAtPoint(TILE_URLS.firePrevention, lat, lng, z),
      queryTileAtPoint(TILE_URLS.useDistrict, lat, lng, z),
    ]);

    const result: PlateauUrfResult = {
      heightDistrict: null,
      fireDistrict: null,
      districtPlan: null,
      useDistrict: null,
    };

    let districtPlanAttrs: Record<string, unknown> | null = null;

    if (heightResult.status === 'fulfilled' && heightResult.value) {
      const { attributes } = heightResult.value;
      const type =
        asString(attributes.function) ??
        asString(attributes.name) ??
        asString(attributes.class) ??
        '不明';

      result.heightDistrict = {
        type,
        maxHeight:
          asNumber(attributes.maximumBuildingHeight) ??
          asNumber(attributes.maxHeight) ??
          asNumber(attributes.absoluteHeight),
        slopeRatio: asNumber(attributes.slopeRatio) ?? asNumber(attributes.inclination),
        attributes,
      };

      districtPlanAttrs = attributes;
    }

    if (fireResult.status === 'fulfilled' && fireResult.value) {
      const { attributes } = fireResult.value;
      result.fireDistrict = {
        type: asString(attributes.function) ?? asString(attributes.name) ?? '指定なし',
        attributes,
      };
      districtPlanAttrs ??= attributes;
    }

    if (useResult.status === 'fulfilled' && useResult.value) {
      const { attributes } = useResult.value;
      result.useDistrict = {
        floorAreaRatio:
          (asNumber(attributes.floorAreaRatio) ?? asNumber(attributes.floor_area_ratio)) !== undefined
            ? (asNumber(attributes.floorAreaRatio) ?? asNumber(attributes.floor_area_ratio))! / 100
            : undefined,
        coverageRatio:
          (asNumber(attributes.buildingCoverageRatio) ?? asNumber(attributes.coverageRatio)) !== undefined
            ? (asNumber(attributes.buildingCoverageRatio) ?? asNumber(attributes.coverageRatio))! / 100
            : undefined,
        district:
          asString(attributes.function) ??
          asString(attributes.districtsAndZonesType) ??
          asString(attributes.zone),
        attributes,
      };
      districtPlanAttrs ??= attributes;
    }

    if (districtPlanAttrs) {
      const planName =
        asString(districtPlanAttrs.districtPlanName) ??
        asString(districtPlanAttrs.districtPlan) ??
        asString(districtPlanAttrs.planName);

      if (planName) {
        result.districtPlan = {
          name: planName,
          restrictions:
            asString(districtPlanAttrs.districtPlanRegulation) ??
            asString(districtPlanAttrs.regulations) ??
            asString(districtPlanAttrs.description),
          maxHeight:
            asNumber(districtPlanAttrs.maximumBuildingHeight) ??
            asNumber(districtPlanAttrs.maxHeight),
          minHeight:
            asNumber(districtPlanAttrs.minimumBuildingHeight) ??
            asNumber(districtPlanAttrs.minHeight) ??
            asNumber(districtPlanAttrs.minimumHeight),
          wallSetback:
            asNumber(districtPlanAttrs.wallSetback) ??
            asNumber(districtPlanAttrs.wallPositionRestriction) ??
            asNumber(districtPlanAttrs.setbackDistance),
          floorAreaRatio:
            asRatio(districtPlanAttrs.floorAreaRatio) ??
            asRatio(districtPlanAttrs.floor_area_ratio),
          coverageRatio:
            asRatio(districtPlanAttrs.buildingCoverageRatio) ??
            asRatio(districtPlanAttrs.coverageRatio),
          attributes: districtPlanAttrs,
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[plateau-urf-lookup] Error:', error);
    return NextResponse.json(
      { error: 'PLATEAU都市計画情報の取得に失敗しました' },
      { status: 500 },
    );
  }
}

