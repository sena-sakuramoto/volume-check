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

function pickRoadSlopeFields(config?: Partial<RoadConfig>): Pick<
  Road,
  | 'frontSetback'
  | 'oppositeSideSetback'
  | 'oppositeOpenSpace'
  | 'oppositeOpenSpaceKind'
  | 'slopeWidthOverride'
  | 'siteHeightAboveRoad'
  | 'enableTwoA35m'
> {
  return {
    frontSetback: config?.frontSetback,
    oppositeSideSetback: config?.oppositeSideSetback,
    oppositeOpenSpace: config?.oppositeOpenSpace,
    oppositeOpenSpaceKind: config?.oppositeOpenSpaceKind,
    slopeWidthOverride: config?.slopeWidthOverride,
    siteHeightAboveRoad: config?.siteHeightAboveRoad,
    enableTwoA35m: config?.enableTwoA35m,
  };
}

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
  config?: Partial<RoadConfig>,
): Road {
  const edgeCount = vertices.length;
  const pickEdgeByDirection = (dir: string): [number, number] | null => {
    if (edgeCount < 2) return null;
    let bestIdx = 0;
    let bestScore = dir === 'south' || dir === 'west' ? Infinity : -Infinity;

    for (let i = 0; i < edgeCount; i++) {
      const j = (i + 1) % edgeCount;
      const midX = (vertices[i].x + vertices[j].x) / 2;
      const midY = (vertices[i].y + vertices[j].y) / 2;
      const score =
        dir === 'south' ? midY :
        dir === 'north' ? midY :
        dir === 'east' ? midX :
        dir === 'west' ? midX :
        Number.NaN;

      if (Number.isNaN(score)) return null;

      const isBetter =
        (dir === 'south' || dir === 'west')
          ? score < bestScore
          : score > bestScore;

      if (isBetter) {
        bestScore = score;
        bestIdx = i;
      }
    }

    return [bestIdx, (bestIdx + 1) % edgeCount];
  };

  const fallbackEdge: [number, number] = edgeCount >= 2 ? [0, 1] : [0, 0];
  const explicitEdge =
    edgeIndices &&
    edgeCount > 0 &&
    edgeIndices[0] >= 0 &&
    edgeIndices[0] < edgeCount &&
    edgeIndices[1] >= 0 &&
    edgeIndices[1] < edgeCount
      ? edgeIndices
      : null;

  const resolvedEdge =
    explicitEdge ??
    (direction ? pickEdgeByDirection(direction) : null) ??
    fallbackEdge;

  const startIdx = resolvedEdge[0];
  const endIdx = resolvedEdge[1];
  const edgeStart = vertices[startIdx] ?? vertices[0] ?? { x: 0, y: 0 };
  const edgeEnd = vertices[endIdx] ?? vertices[1] ?? edgeStart;

  const isCCW = calcSignedArea(vertices) > 0;
  let bearing = outwardBearing(edgeStart, edgeEnd, isCCW);

  if (!explicitEdge && direction) {
    const dirMap: Record<string, number> = { south: 180, north: 0, east: 90, west: 270 };
    bearing = dirMap[direction] ?? 180;
  }

  return {
    edgeStart,
    edgeEnd,
    width: roadWidth,
    centerOffset: roadWidth / 2,
    bearing,
    ...pickRoadSlopeFields(config),
  };
}

export function buildRoad(
  width: number,
  depth: number,
  roadWidth: number,
  direction: RoadDirection,
  config?: Partial<RoadConfig>,
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
    ...pickRoadSlopeFields(config),
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
  return configs.map((rc) => buildRoad(siteWidth, siteDepth, rc.width, rc.direction, rc));
}

export function buildRoadsFromPolygonConfigs(
  vertices: Point2D[],
  configs: RoadConfig[],
): Road[] {
  const edgeCount = vertices.length;
  if (edgeCount < 2) {
    return configs.map((rc) =>
      buildRoadFromEdge(vertices, rc.width, rc.edgeVertexIndices, rc.direction, rc),
    );
  }

  const usedEdgeIds = new Set<number>();

  return configs.map((rc) => {
    const explicitEdgeId = rc.edgeVertexIndices
      ? toBoundaryEdgeId(rc.edgeVertexIndices, edgeCount)
      : null;

    let resolvedEdge: [number, number];
    if (explicitEdgeId !== null && !usedEdgeIds.has(explicitEdgeId)) {
      resolvedEdge = rc.edgeVertexIndices!;
      usedEdgeIds.add(explicitEdgeId);
    } else {
      const rankedIds = rankBoundaryEdgesByDirection(vertices, rc.direction);
      const candidateId = rankedIds.find((id) => !usedEdgeIds.has(id))
        ?? (explicitEdgeId ?? rankedIds[0] ?? 0);
      usedEdgeIds.add(candidateId);
      resolvedEdge = [candidateId, (candidateId + 1) % edgeCount];
    }

    return buildRoadFromEdge(vertices, rc.width, resolvedEdge, rc.direction, rc);
  });
}

function toBoundaryEdgeId(pair: [number, number], edgeCount: number): number | null {
  const [a, b] = pair;
  if (
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 ||
    b < 0 ||
    a >= edgeCount ||
    b >= edgeCount
  ) {
    return null;
  }
  if (b === (a + 1) % edgeCount) return a;
  if (a === (b + 1) % edgeCount) return b;
  return null;
}

function rankBoundaryEdgesByDirection(vertices: Point2D[], direction: string): number[] {
  const edgeCount = vertices.length;
  const desc = direction === 'north' || direction === 'east';
  const byX = direction === 'east' || direction === 'west';

  const ranked = Array.from({ length: edgeCount }, (_, i) => {
    const j = (i + 1) % edgeCount;
    const start = vertices[i];
    const end = vertices[j];
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const score = byX ? midX : midY;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    return { id: i, score, length };
  });

  ranked.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-9) {
      return desc ? b.score - a.score : a.score - b.score;
    }
    if (Math.abs(a.length - b.length) > 1e-9) {
      return b.length - a.length;
    }
    return a.id - b.id;
  });

  return ranked.map((r) => r.id);
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

  const nx = isCCW ? -dy : dy;
  const ny = isCCW ? dx : -dx;
  const bearing = (Math.atan2(nx, ny) * 180) / Math.PI;
  return ((bearing % 360) + 360) % 360;
}
