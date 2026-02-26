import type { Point2D } from './types';

/** Calculate distance from point to line segment */
export function distanceToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.sqrt((p.x - proj.x) ** 2 + (p.y - proj.y) ** 2);
}

/** Calculate polygon area using Shoelace formula */
export function polygonArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/** Get the outward normal of a polygon edge (clockwise winding) */
export function edgeOutwardNormal(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: dy / len, y: -dx / len };
}

/**
 * Compute the outward normal angle (radians, math convention: 0=+X, PI/2=+Y)
 * for a CW polygon edge from a to b.
 * For CW winding, outward normal of edge (a→b) is (dy, -dx).
 */
export function edgeOutwardAngle(a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Outward normal for CW winding: (dy, -dx)
  return Math.atan2(-dx, dy);
}

/**
 * Compute intersection point of two line segments.
 * Returns the intersection point or null if segments don't intersect.
 */
export function segmentsIntersectionPoint(
  a1: Point2D,
  a2: Point2D,
  b1: Point2D,
  b2: Point2D,
): Point2D | null {
  const d1x = a2.x - a1.x;
  const d1y = a2.y - a1.y;
  const d2x = b2.x - b1.x;
  const d2y = b2.y - b1.y;

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // Parallel

  const t = ((b1.x - a1.x) * d2y - (b1.y - a1.y) * d2x) / denom;
  const u = ((b1.x - a1.x) * d1y - (b1.y - a1.y) * d1x) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null; // Outside segments

  return {
    x: a1.x + t * d1x,
    y: a1.y + t * d1y,
  };
}

/** Check if a point is inside a polygon (ray casting) */
export function isInsidePolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if a polygon is simple (no self-intersections).
 * O(n²) segment-vs-segment test, skipping adjacent edges.
 */
export function isSimplePolygon(vertices: Point2D[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges (they share a vertex)
      if (i === 0 && j === n - 1) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsCross(a1, a2, b1, b2)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Check if two line segments (a1-a2) and (b1-b2) intersect properly
 * (crossing, not just touching at endpoints).
 */
function segmentsCross(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

/** Cross product of vectors (b-a) and (c-a) */
function cross(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
