import type { Point2D } from './types';
import { segmentsIntersectionPoint, polygonArea, isSimplePolygon } from './geometry';

/**
 * Inset a polygon by a given distance for wall setback (外壁後退).
 * Uses bisector-based offset for each vertex.
 * Assumes clockwise winding order (consistent with SiteBoundary).
 *
 * For concave polygons (L-shape, U-shape), the naive offset may produce
 * self-intersecting geometry. In that case, we resolve the intersections
 * and return the largest non-self-intersecting sub-polygon.
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

  // Check for self-intersection and resolve if needed
  if (!isSimplePolygon(result)) {
    return resolveSelfintersection(result);
  }

  return result;
}

/**
 * Resolve self-intersections in an offset polygon.
 *
 * Algorithm:
 * 1. Find all intersection points between non-adjacent edges
 * 2. Split the polygon at intersection points into sub-polygons
 * 3. Return the sub-polygon with the largest area
 */
function resolveSelfintersection(vertices: Point2D[]): Point2D[] {
  const n = vertices.length;

  // Build edge list with intersection info
  // For each edge, collect (t, intersectionPoint, otherEdgeIndex) pairs
  interface Intersection {
    t: number; // parameter along this edge [0,1]
    point: Point2D;
    otherEdge: number;
    otherT: number;
  }

  const edgeIntersections: Intersection[][] = [];
  for (let i = 0; i < n; i++) {
    edgeIntersections.push([]);
  }

  // Find all non-adjacent edge intersections
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // Skip adjacent
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];

      const pt = segmentsIntersectionPoint(a1, a2, b1, b2);
      if (pt) {
        const tI = parameterOnSegment(a1, a2, pt);
        const tJ = parameterOnSegment(b1, b2, pt);
        edgeIntersections[i].push({ t: tI, point: pt, otherEdge: j, otherT: tJ });
        edgeIntersections[j].push({ t: tJ, point: pt, otherEdge: i, otherT: tI });
      }
    }
  }

  // Sort intersections on each edge by t
  for (const arr of edgeIntersections) {
    arr.sort((a, b) => a.t - b.t);
  }

  // Extract sub-polygons by tracing the polygon, switching at intersections
  const subPolygons: Point2D[][] = [];
  const visited = new Set<string>();

  for (let startEdge = 0; startEdge < n; startEdge++) {
    for (let startIx = 0; startIx < edgeIntersections[startEdge].length; startIx++) {
      const key = `${startEdge}:${startIx}`;
      if (visited.has(key)) continue;

      const poly: Point2D[] = [];
      let edge = startEdge;
      let ix = startIx;
      let maxIter = n * 4; // Safety limit

      while (maxIter-- > 0) {
        const intInfo = edgeIntersections[edge][ix];
        const intKey = `${edge}:${ix}`;
        if (visited.has(intKey) && poly.length > 2) break;
        visited.add(intKey);

        poly.push(intInfo.point);

        // Jump to the other edge at the intersection
        const nextEdge = intInfo.otherEdge;

        // Trace along nextEdge: add vertices after the intersection point
        // until we reach the next intersection or loop back
        let curEdge = nextEdge;
        let curT = intInfo.otherT;
        let foundNext = false;

        // Walk edges adding original vertices
        for (let step = 0; step < n; step++) {
          const nextEdgeIdx = (curEdge + 1) % n;
          // Check if there's another intersection on curEdge after curT
          const nextIntersection = edgeIntersections[curEdge].find(
            x => x.t > curT + 1e-10
          );

          if (nextIntersection) {
            // Found next intersection on same edge
            poly.push(nextIntersection.point);
            edge = curEdge;
            ix = edgeIntersections[curEdge].indexOf(nextIntersection);
            foundNext = true;
            break;
          }

          // Add the end vertex of current edge and move to next edge
          poly.push(vertices[(curEdge + 1) % n]);
          curEdge = nextEdgeIdx;
          curT = 0;

          // Check for intersections on the new edge
          if (edgeIntersections[curEdge].length > 0) {
            const firstInt = edgeIntersections[curEdge][0];
            poly.push(firstInt.point);
            edge = curEdge;
            ix = 0;
            foundNext = true;
            break;
          }
        }

        if (!foundNext) break;

        // Check if we've returned to start
        const curKey = `${edge}:${ix}`;
        if (curKey === key) break;
      }

      if (poly.length >= 3) {
        subPolygons.push(poly);
      }
    }
  }

  // If no valid sub-polygons found, return original
  if (subPolygons.length === 0) {
    return vertices;
  }

  // Return the sub-polygon with the largest area
  let bestPoly = subPolygons[0];
  let bestArea = polygonArea(bestPoly);

  for (let i = 1; i < subPolygons.length; i++) {
    const area = polygonArea(subPolygons[i]);
    if (area > bestArea) {
      bestArea = area;
      bestPoly = subPolygons[i];
    }
  }

  return bestPoly;
}

/** Calculate parameter t for a point on a segment */
function parameterOnSegment(a: Point2D, b: Point2D, p: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-20) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
}

/** Normalize a 2D vector to unit length */
function normalize(v: Point2D): Point2D {
  const len = Math.sqrt(v.x ** 2 + v.y ** 2);
  return { x: v.x / len, y: v.y / len };
}
