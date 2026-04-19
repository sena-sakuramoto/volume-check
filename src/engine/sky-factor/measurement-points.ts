import type { Point3D, Road, SiteBoundary } from '../types';

export type MeasurementPointKind = 'road' | 'adjacent' | 'north';

export interface MeasurementPoint {
  kind: MeasurementPointKind;
  /** 0-based index along the boundary */
  index: number;
  /** Total points of same kind (used for labels e.g. "3 / 12") */
  total: number;
  /** World-space measurement point (y = height 1.5m from ground) */
  position: Point3D;
  /** Label for UI: "道路斜線(反対側境界)" etc. */
  label: string;
  /** Road reference if kind === 'road' */
  roadIndex?: number;
}

const EYE_HEIGHT = 1.5; // m
const ROAD_POINT_INTERVAL = 2.0; // m along the road
const ADJ_POINT_INTERVAL = 2.0;
const ADJ_OFFSET = 16; // m outward from adjacent boundary (令135-7 general)
const NORTH_OFFSET = 4; // m outward from north boundary (令135-8 low-rise default)

function perpUnit(dx: number, dy: number): { nx: number; ny: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { nx: 0, ny: 0 };
  return { nx: -dy / len, ny: dx / len };
}

/**
 * Generate measurement points for road setback (56-1-1 ⇒ 56-7):
 * Points are placed on the opposite side of the road, on the projection of
 * each site vertex that lies on the road edge. Spaced every ROAD_POINT_INTERVAL.
 */
function roadPoints(roads: Road[]): MeasurementPoint[] {
  const out: MeasurementPoint[] = [];
  let globalIdx = 0;
  for (let r = 0; r < roads.length; r++) {
    const road = roads[r];
    const { edgeStart: A, edgeEnd: B, width } = road;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;

    // Outward normal (pointing AWAY from the site, toward the road opposite side)
    const { nx, ny } = perpUnit(dx, dy);
    // road opposite side offset = width (reverse side boundary)
    const ox = -nx * width;
    const oy = -ny * width;

    const nSteps = Math.max(2, Math.ceil(len / ROAD_POINT_INTERVAL));
    for (let s = 0; s <= nSteps; s++) {
      const t = s / nSteps;
      const px = A.x + dx * t + ox;
      const py = A.y + dy * t + oy;
      out.push({
        kind: 'road',
        index: globalIdx++,
        total: 0,
        position: { x: px, y: EYE_HEIGHT, z: py },
        label: '道路斜線(反対側境界)',
        roadIndex: r,
      });
    }
  }
  const total = out.length;
  return out.map((p) => ({ ...p, total }));
}

/**
 * Generate adjacent boundary measurement points: edges that are NOT road edges.
 * Points placed at ADJ_OFFSET outward from each non-road edge.
 */
function adjacentPoints(site: SiteBoundary, roads: Road[]): MeasurementPoint[] {
  const v = site.vertices;
  if (v.length < 3) return [];
  const roadEdgeSet = new Set<string>();
  for (const r of roads) {
    // Find which site edge matches this road
    for (let i = 0; i < v.length; i++) {
      const a = v[i];
      const b = v[(i + 1) % v.length];
      const matchAB =
        Math.hypot(a.x - r.edgeStart.x, a.y - r.edgeStart.y) < 0.2 &&
        Math.hypot(b.x - r.edgeEnd.x, b.y - r.edgeEnd.y) < 0.2;
      const matchBA =
        Math.hypot(a.x - r.edgeEnd.x, a.y - r.edgeEnd.y) < 0.2 &&
        Math.hypot(b.x - r.edgeStart.x, b.y - r.edgeStart.y) < 0.2;
      if (matchAB || matchBA) roadEdgeSet.add(`${i}-${(i + 1) % v.length}`);
    }
  }

  const out: MeasurementPoint[] = [];
  let globalIdx = 0;
  for (let i = 0; i < v.length; i++) {
    const key = `${i}-${(i + 1) % v.length}`;
    if (roadEdgeSet.has(key)) continue;
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const { nx, ny } = perpUnit(dx, dy);
    // outward (away from site interior). Since site is clockwise, (nx,ny) should point outside.
    const nSteps = Math.max(2, Math.ceil(len / ADJ_POINT_INTERVAL));
    for (let s = 0; s <= nSteps; s++) {
      const t = s / nSteps;
      const px = a.x + dx * t - nx * ADJ_OFFSET;
      const py = a.y + dy * t - ny * ADJ_OFFSET;
      out.push({
        kind: 'adjacent',
        index: globalIdx++,
        total: 0,
        position: { x: px, y: EYE_HEIGHT, z: py },
        label: '隣地斜線',
      });
    }
  }
  const total = out.length;
  return out.map((p) => ({ ...p, total }));
}

/**
 * Generate north boundary measurement points: edges whose outward normal points roughly north.
 * Heuristic: bearing within ±45° of north.
 */
function northPoints(site: SiteBoundary): MeasurementPoint[] {
  const v = site.vertices;
  if (v.length < 3) return [];
  const out: MeasurementPoint[] = [];
  let globalIdx = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    const b = v[(i + 1) % v.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const { nx, ny } = perpUnit(dx, dy);
    // outward normal bearing (0=north, 90=east in our convention: +y is north here)
    const bearing = ((Math.atan2(-nx, -ny) * 180) / Math.PI + 360) % 360;
    const offsetFromNorth = Math.min(bearing, 360 - bearing);
    if (offsetFromNorth > 45) continue; // not a north-facing edge
    const nSteps = Math.max(2, Math.ceil(len / ADJ_POINT_INTERVAL));
    for (let s = 0; s <= nSteps; s++) {
      const t = s / nSteps;
      const px = a.x + dx * t - nx * NORTH_OFFSET;
      const py = a.y + dy * t - ny * NORTH_OFFSET;
      out.push({
        kind: 'north',
        index: globalIdx++,
        total: 0,
        position: { x: px, y: EYE_HEIGHT, z: py },
        label: '北側斜線',
      });
    }
  }
  const total = out.length;
  return out.map((p) => ({ ...p, total }));
}

export function generateMeasurementPoints(
  site: SiteBoundary,
  roads: Road[],
): MeasurementPoint[] {
  return [...roadPoints(roads), ...adjacentPoints(site, roads), ...northPoints(site)];
}
