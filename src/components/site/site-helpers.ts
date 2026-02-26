import type {
  SiteBoundary,
  Road,
  ZoningData,
  ZoningDistrict,
  FireDistrict,
  HeightDistrict,
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
  const startIdx = edgeIndices?.[0] ?? 0;
  const endIdx = edgeIndices?.[1] ?? 1;
  const edgeStart = vertices[startIdx] ?? vertices[0];
  const edgeEnd = vertices[endIdx] ?? vertices[1];

  const dx = edgeEnd.x - edgeStart.x;
  const dy = edgeEnd.y - edgeStart.y;
  let bearing = 180;
  if (direction) {
    const dirMap: Record<string, number> = { south: 180, north: 0, east: 90, west: 270 };
    bearing = dirMap[direction] ?? 180;
  } else {
    const normalAngle = Math.atan2(-dx, dy) * (180 / Math.PI);
    bearing = ((normalAngle % 360) + 360) % 360;
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
  };
}

export function normalizeRatio(value: number): number {
  if (value > 1) return value / 100;
  return value;
}

export function matchDistrict(raw: string): ZoningDistrict | null {
  if (ALL_DISTRICTS.includes(raw as ZoningDistrict)) {
    return raw as ZoningDistrict;
  }
  for (const d of ALL_DISTRICTS) {
    if (raw.includes(d) || d.includes(raw)) {
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
