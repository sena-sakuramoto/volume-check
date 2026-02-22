import type { Point2D } from './types';

/**
 * Inset a polygon by a given distance for wall setback (外壁後退).
 * Uses bisector-based offset for each vertex.
 * Assumes clockwise winding order (consistent with SiteBoundary).
 *
 * For convex polygons, inward normals point inward and the polygon
 * shrinks uniformly. For concave polygons, results are approximate
 * and may produce self-intersecting geometry in extreme cases.
 *
 * @param vertices - Polygon vertices in clockwise order
 * @param setback - Setback distance in meters (null or 0 means no setback)
 * @returns Inset polygon vertices
 */
export function applyWallSetback(vertices: Point2D[], setback: number | null): Point2D[] {
  if (setback === null || setback === 0) return vertices;

  const n = vertices.length;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    // Edge vectors
    const e1 = { x: curr.x - prev.x, y: curr.y - prev.y };
    const e2 = { x: next.x - curr.x, y: next.y - curr.y };

    // Inward normals (for clockwise winding, inward = left-hand normal)
    const n1 = normalize({ x: -e1.y, y: e1.x });
    const n2 = normalize({ x: -e2.y, y: e2.x });

    // Bisector of the two inward normals
    const bisector = { x: n1.x + n2.x, y: n1.y + n2.y };
    const bisectorLen = Math.sqrt(bisector.x ** 2 + bisector.y ** 2);

    if (bisectorLen < 1e-10) {
      // Normals are opposite (180-degree turn) - offset along one normal
      result.push({
        x: curr.x + n1.x * setback,
        y: curr.y + n1.y * setback,
      });
    } else {
      // Project the setback distance onto the bisector direction
      const dot = n1.x * (bisector.x / bisectorLen) + n1.y * (bisector.y / bisectorLen);
      const offset = setback / dot;
      result.push({
        x: curr.x + (bisector.x / bisectorLen) * offset,
        y: curr.y + (bisector.y / bisectorLen) * offset,
      });
    }
  }

  return result;
}

/** Normalize a 2D vector to unit length */
function normalize(v: Point2D): Point2D {
  const len = Math.sqrt(v.x ** 2 + v.y ** 2);
  return { x: v.x / len, y: v.y / len };
}
