export interface ParcelCandidate {
  chiban: string;
  coordinates: [number, number][][];
  containsPoint?: boolean;
  distanceMeters?: number | null;
}

export interface ShapeCandidate {
  coordinates: [number, number][][];
  containsPoint?: boolean;
  distanceMeters?: number | null;
}

export interface DistrictBreakdownItem {
  district: string;
  ratio: number;
  coverageRatio?: number;
  floorAreaRatio?: number;
  fireDistrict?: string;
}

export interface GeoRingPoint {
  lat: number;
  lng: number;
}

export function pickDefaultParcelIndex(parcels: ShapeCandidate[]): number {
  if (!Array.isArray(parcels) || parcels.length === 0) return -1;
  const containsPointIndex = parcels.findIndex((parcel) => parcel.containsPoint);
  return containsPointIndex >= 0 ? containsPointIndex : -1;
}

export function toGeoRingFromParcel(parcel: ShapeCandidate): GeoRingPoint[] | null {
  const outer = parcel.coordinates?.[0];
  if (!Array.isArray(outer) || outer.length < 3) return null;

  const ring: GeoRingPoint[] = [];
  for (const point of outer) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const [lng, lat] = point;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    ring.push({ lat, lng });
  }
  return ring.length >= 3 ? ring : null;
}

export function summarizeDistrictBreakdown(districts: DistrictBreakdownItem[]): string {
  if (!Array.isArray(districts) || districts.length === 0) return '';
  return districts
    .filter((item) => item.ratio > 0)
    .map((item) => `${item.district} ${Math.round(item.ratio * 100)}%`)
    .join(' / ');
}

function normalizeRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function pickStrictestFireDistrict(districts: DistrictBreakdownItem[]): string {
  const rank: Record<string, number> = {
    指定なし: 0,
    準防火地域: 1,
    防火地域: 2,
  };
  let selected = '指定なし';
  let selectedRank = 0;

  for (const district of districts) {
    if (!(district.ratio > 0)) continue;
    const name = typeof district.fireDistrict === 'string' ? district.fireDistrict : '指定なし';
    const nextRank = rank[name] ?? 0;
    if (nextRank > selectedRank) {
      selected = name;
      selectedRank = nextRank;
    }
  }

  return selected;
}

export function deriveEffectiveZoningFromBreakdown(
  districts: DistrictBreakdownItem[],
): { coverageRatio: number; floorAreaRatio: number; fireDistrict: string } | null {
  if (!Array.isArray(districts) || districts.length === 0) return null;

  let weightedCoverage = 0;
  let weightedFar = 0;
  let totalRatio = 0;

  for (const district of districts) {
    if (!(district.ratio > 0)) continue;
    if (!Number.isFinite(district.coverageRatio) || !Number.isFinite(district.floorAreaRatio)) continue;

    const ratio = district.ratio;
    weightedCoverage += normalizeRatio(district.coverageRatio as number) * ratio;
    weightedFar += normalizeRatio(district.floorAreaRatio as number) * ratio;
    totalRatio += ratio;
  }

  if (totalRatio <= 0) return null;

  return {
    coverageRatio: weightedCoverage / totalRatio,
    floorAreaRatio: weightedFar / totalRatio,
    fireDistrict: pickStrictestFireDistrict(districts),
  };
}
