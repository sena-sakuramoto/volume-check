import type {
  SiteBoundary,
  Road,
  ZoningData,
  ZoningDistrict,
  FireDistrict,
  HeightDistrict,
  DistrictPlanInfo,
  Point2D,
} from '@/engine/types';
import { getZoningDefaults } from '@/engine';
import type { RoadDirection, RoadConfig } from './site-types';
import { ROAD_DIRECTION_OPTIONS, ALL_DISTRICTS } from './site-types';

/** Shoelace formula for polygon area */
export function calcPolygonArea(verts: { x: number; y: number }[]): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
  }
  return Math.abs(area) / 2;
}

export function buildPolygonSite(
  vertices: { x: number; y: number }[],
  providedArea?: number,
): SiteBoundary {
  const area = providedArea ?? calcPolygonArea(vertices);
  return { vertices, area };
}

export function buildRectSite(width: number, depth: number): SiteBoundary {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth },
      { x: 0, y: depth },
    ],
    area: width * depth,
  };
}

export function buildRoadFromEdge(
  vertices: { x: number; y: number }[],
  roadWidth: number,
  edgeIndices?: [number, number],
  direction?: string,
): Road {
  const edgeCount = vertices.length;
  const pickEdgeByDirection = (dir: string): [number, number] | null => {
    if (edgeCount < 2) return null;
    const dirMap: Record<string, number> = { south: 180, north: 0, east: 90, west: 270 };
    const target = dirMap[dir];
    if (target === undefined) return null;

    const isCCW = calcSignedArea(vertices) > 0;
    let bestIdx = 0;
    let bestGap = Infinity;

    for (let i = 0; i < edgeCount; i++) {
      const j = (i + 1) % edgeCount;
      const b = outwardBearing(vertices[i], vertices[j], isCCW);
      const gap = circularBearingGap(target, b);
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }

    return [bestIdx, (bestIdx + 1) % edgeCount];
  };

  const fallbackEdge: [number, number] = edgeCount >= 2 ? [0, 1] : [0, 0];
  const resolvedEdge =
    (edgeIndices &&
      edgeCount > 0 &&
      edgeIndices[0] >= 0 &&
      edgeIndices[0] < edgeCount &&
      edgeIndices[1] >= 0 &&
      edgeIndices[1] < edgeCount
      ? edgeIndices
      : null) ??
    (direction ? pickEdgeByDirection(direction) : null) ??
    fallbackEdge;

  const startIdx = resolvedEdge[0];
  const endIdx = resolvedEdge[1];
  const edgeStart = vertices[startIdx] ?? vertices[0] ?? { x: 0, y: 0 };
  const edgeEnd = vertices[endIdx] ?? vertices[1] ?? edgeStart;

  let bearing = 180;
  if (direction) {
    const dirMap: Record<string, number> = { south: 180, north: 0, east: 90, west: 270 };
    bearing = dirMap[direction] ?? 180;
  } else {
    const isCCW = calcSignedArea(vertices) > 0;
    bearing = outwardBearing(edgeStart, edgeEnd, isCCW);
  }

  return { edgeStart, edgeEnd, width: roadWidth, centerOffset: roadWidth / 2, bearing };
}

export function buildRoad(
  width: number,
  depth: number,
  roadWidth: number,
  direction: RoadDirection,
): Road {
  const dirInfo = ROAD_DIRECTION_OPTIONS.find((d) => d.key === direction)!;
  let edgeStart: { x: number; y: number };
  let edgeEnd: { x: number; y: number };

  switch (direction) {
    case 'south':
      edgeStart = { x: 0, y: 0 };
      edgeEnd = { x: width, y: 0 };
      break;
    case 'north':
      edgeStart = { x: width, y: depth };
      edgeEnd = { x: 0, y: depth };
      break;
    case 'east':
      edgeStart = { x: width, y: 0 };
      edgeEnd = { x: width, y: depth };
      break;
    case 'west':
      edgeStart = { x: 0, y: depth };
      edgeEnd = { x: 0, y: 0 };
      break;
  }

  return {
    edgeStart,
    edgeEnd,
    width: roadWidth,
    centerOffset: roadWidth / 2,
    bearing: dirInfo.bearing,
  };
}

export function buildZoningData(
  district: ZoningDistrict,
  overrides?: {
    coverageRatio?: number;
    floorAreaRatio?: number;
    fireDistrict?: FireDistrict;
    heightDistrict?: HeightDistrict;
    isCornerLot?: boolean;
    districtPlan?: DistrictPlanInfo | null;
  },
): ZoningData {
  const defaults = getZoningDefaults(district);
  return {
    district,
    fireDistrict: overrides?.fireDistrict ?? '指定なし',
    heightDistrict: overrides?.heightDistrict ?? { type: '指定なし' },
    coverageRatio: overrides?.coverageRatio ?? defaults.defaultCoverageRatio,
    floorAreaRatio: overrides?.floorAreaRatio ?? defaults.defaultFloorAreaRatio,
    absoluteHeightLimit: defaults.absoluteHeightLimit,
    wallSetback: defaults.wallSetback,
    shadowRegulation: defaults.shadowRegulation,
    isCornerLot: overrides?.isCornerLot ?? false,
    districtPlan: overrides?.districtPlan ?? null,
  };
}

export function normalizeRatio(value: number): number {
  if (value > 1) return value / 100;
  return value;
}

const DISTRICT_CODE_MAP: Record<string, ZoningDistrict> = {
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

const DISTRICT_ALIAS_MAP: Record<string, ZoningDistrict> = {
  '1低専': '第一種低層住居専用地域',
  '2低専': '第二種低層住居専用地域',
  '1中高': '第一種中高層住居専用地域',
  '2中高': '第二種中高層住居専用地域',
  '1住': '第一種住居地域',
  '2住': '第二種住居地域',
  '準住': '準住居地域',
  '近商': '近隣商業地域',
  '準工': '準工業地域',
  '工専': '工業専用地域',
};

function normalizeDistrictText(raw: string): string {
  return raw
    .trim()
    .replace(/[ \t　]/g, '')
    .replace(/[()（）]/g, '')
    .replace(/第?1種/g, '第一種')
    .replace(/第?2種/g, '第二種')
    .replace(/第?3種/g, '第三種')
    .replace(/住居専用$/, '住居専用地域')
    .replace(/住居$/, '住居地域')
    .replace(/準住居$/, '準住居地域')
    .replace(/近隣商業$/, '近隣商業地域')
    .replace(/商業$/, '商業地域')
    .replace(/準工業$/, '準工業地域')
    .replace(/工業専用$/, '工業専用地域')
    .replace(/工業$/, '工業地域');
}

export function matchDistrict(raw: string): ZoningDistrict | null {
  const normalized = normalizeDistrictText(raw);
  if (!normalized) return null;

  if (ALL_DISTRICTS.includes(normalized as ZoningDistrict)) {
    return normalized as ZoningDistrict;
  }

  if (DISTRICT_ALIAS_MAP[normalized]) {
    return DISTRICT_ALIAS_MAP[normalized];
  }

  if (DISTRICT_CODE_MAP[normalized]) {
    return DISTRICT_CODE_MAP[normalized];
  }

  const codeMatch = normalized.match(/(?:用途地域コード|コード|code|zone)?[:：=]?([0-9]{1,2})$/i);
  if (codeMatch) {
    const code = codeMatch[1];
    if (DISTRICT_CODE_MAP[code]) return DISTRICT_CODE_MAP[code];
    if (DISTRICT_CODE_MAP[code.padStart(2, '0')]) return DISTRICT_CODE_MAP[code.padStart(2, '0')];
  }

  for (const d of ALL_DISTRICTS) {
    const normalizedDistrict = normalizeDistrictText(d);
    if (normalized.includes(normalizedDistrict) || normalizedDistrict.includes(normalized)) {
      return d;
    }
  }
  return null;
}

export function matchFireDistrict(raw: string): FireDistrict {
  if (raw.includes('準防火')) return '準防火地域';
  if (raw.includes('防火')) return '防火地域';
  return '指定なし';
}

export function matchHeightDistrictType(
  raw: string,
): '第一種' | '第二種' | '第三種' | '指定なし' | null {
  if (!raw) return null;
  if (raw.includes('第一種') || raw.includes('1種') || raw.includes('第1種')) return '第一種';
  if (raw.includes('第二種') || raw.includes('2種') || raw.includes('第2種')) return '第二種';
  if (raw.includes('第三種') || raw.includes('3種') || raw.includes('第3種')) return '第三種';
  return null;
}

export function shortenDistrict(d: ZoningDistrict): string {
  return d.replace('専用地域', '専用').replace('地域', '');
}

/** Build all roads from RoadConfigs for a rectangular site */
export function buildRoadsFromConfigs(
  siteWidth: number,
  siteDepth: number,
  configs: RoadConfig[],
): Road[] {
  return configs.map((rc) => buildRoad(siteWidth, siteDepth, rc.width, rc.direction));
}

function calcSignedArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function outwardBearing(a: Point2D, b: Point2D, isCCW: boolean): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return 0;

  const nx = isCCW ? dy : -dy;
  const ny = isCCW ? -dx : dx;
  const bearing = (Math.atan2(nx, ny) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}

function circularBearingGap(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}
