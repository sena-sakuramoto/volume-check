export interface TilePoint {
  x: number;
  y: number;
}

export interface DistrictSample {
  district: string;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
}

export interface DistrictBreakdown {
  district: string;
  ratio: number;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
}

interface DistrictAccumulator {
  count: number;
  coverageSum: number;
  farSum: number;
  fireCounts: Map<string, number>;
}

function pointInPolygon(px: number, py: number, ring: TilePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pickMostFrequent(values: Map<string, number>, fallback: string): string {
  let selected = fallback;
  let bestCount = -1;
  for (const [name, count] of values.entries()) {
    if (count > bestCount) {
      bestCount = count;
      selected = name;
    }
  }
  return selected;
}

export function aggregateDistrictsFromSampling(
  sitePolygon: TilePoint[],
  resolveDistrictAtPoint: (x: number, y: number) => DistrictSample | null,
  options?: { step?: number },
): DistrictBreakdown[] {
  if (!Array.isArray(sitePolygon) || sitePolygon.length < 3) return [];

  const step = Math.max(1, Math.floor(options?.step ?? 8));
  const minX = Math.min(...sitePolygon.map((p) => p.x));
  const maxX = Math.max(...sitePolygon.map((p) => p.x));
  const minY = Math.min(...sitePolygon.map((p) => p.y));
  const maxY = Math.max(...sitePolygon.map((p) => p.y));

  const accum = new Map<string, DistrictAccumulator>();
  let totalHits = 0;

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (!pointInPolygon(x, y, sitePolygon)) continue;
      const sample = resolveDistrictAtPoint(x, y);
      if (!sample) continue;

      const district = sample.district.trim();
      if (!district) continue;

      const state = accum.get(district) ?? {
        count: 0,
        coverageSum: 0,
        farSum: 0,
        fireCounts: new Map<string, number>(),
      };
      state.count += 1;
      state.coverageSum += sample.coverageRatio;
      state.farSum += sample.floorAreaRatio;
      state.fireCounts.set(
        sample.fireDistrict,
        (state.fireCounts.get(sample.fireDistrict) ?? 0) + 1,
      );
      accum.set(district, state);
      totalHits += 1;
    }
  }

  if (totalHits === 0) return [];

  const districts: DistrictBreakdown[] = [];
  for (const [district, state] of accum.entries()) {
    districts.push({
      district,
      ratio: state.count / totalHits,
      coverageRatio: state.coverageSum / state.count,
      floorAreaRatio: state.farSum / state.count,
      fireDistrict: pickMostFrequent(state.fireCounts, '指定なし'),
    });
  }

  districts.sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    return a.district.localeCompare(b.district, 'ja');
  });

  return districts;
}

export function pickDominantDistrict(
  districts: DistrictBreakdown[],
): DistrictBreakdown | null {
  if (!Array.isArray(districts) || districts.length === 0) return null;
  let dominant = districts[0];
  for (const district of districts) {
    if (district.ratio > dominant.ratio) dominant = district;
  }
  return dominant;
}

