import type { Point2D } from '@/engine/types';

export interface LocalRoadLine {
  points: Point2D[];
  width: number;
  name?: string;
  highway?: string;
}

export interface InferredRoadEdge {
  edgeVertexIndices: [number, number];
  width: number;
  distance: number;
  direction: 'north' | 'south' | 'east' | 'west';
  name?: string;
  highway?: string;
}

interface InferRoadOptions {
  maxDistance?: number;
  minParallel?: number;
  maxEdges?: number;
}

type EdgeEvaluation = {
  distance: number;
  parallel: number;
  road: LocalRoadLine;
};

const EPSILON = 1e-9;

function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

function magnitude(x: number, y: number): number {
  return Math.hypot(x, y);
}

function normalize(x: number, y: number): { x: number; y: number; len: number } {
  const len = magnitude(x, y);
  if (len < EPSILON) return { x: 0, y: 0, len: 0 };
  return { x: x / len, y: y / len, len };
}

function pointToSegmentDistance(point: Point2D, a: Point2D, b: Point2D): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq < EPSILON) return magnitude(point.x - a.x, point.y - a.y);

  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const t = Math.max(0, Math.min(1, dot(apx, apy, abx, aby) / abLenSq));
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return magnitude(point.x - cx, point.y - cy);
}

function ccw(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const abC = ccw(a, b, c);
  const abD = ccw(a, b, d);
  const cdA = ccw(c, d, a);
  const cdB = ccw(c, d, b);

  if (Math.abs(abC) < EPSILON && Math.abs(abD) < EPSILON && Math.abs(cdA) < EPSILON && Math.abs(cdB) < EPSILON) {
    const minAx = Math.min(a.x, b.x);
    const maxAx = Math.max(a.x, b.x);
    const minAy = Math.min(a.y, b.y);
    const maxAy = Math.max(a.y, b.y);
    const minCx = Math.min(c.x, d.x);
    const maxCx = Math.max(c.x, d.x);
    const minCy = Math.min(c.y, d.y);
    const maxCy = Math.max(c.y, d.y);
    return !(maxAx < minCx || maxCx < minAx || maxAy < minCy || maxCy < minAy);
  }

  return abC * abD <= 0 && cdA * cdB <= 0;
}

function segmentToSegmentDistance(a: Point2D, b: Point2D, c: Point2D, d: Point2D): number {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  );
}

function edgeDirectionByMidpoint(vertices: Point2D[], edgeStart: Point2D, edgeEnd: Point2D): 'north' | 'south' | 'east' | 'west' {
  // Determine side by midpoint vector from polygon centroid.
  // This is more stable for rotated/irregular lots than bbox-edge proximity.
  const centerX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
  const centerY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  const midX = (edgeStart.x + edgeEnd.x) / 2;
  const midY = (edgeStart.y + edgeEnd.y) / 2;
  const dx = midX - centerX;
  const dy = midY - centerY;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? 'east' : 'west';
  }
  return dy >= 0 ? 'north' : 'south';
}

function evaluateEdgeAgainstRoad(
  edgeStart: Point2D,
  edgeEnd: Point2D,
  road: LocalRoadLine,
  maxDistance: number,
  minParallel: number,
): EdgeEvaluation | null {
  const edgeVec = normalize(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
  if (edgeVec.len < EPSILON) return null;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestParallel = 0;

  for (let i = 0; i < road.points.length - 1; i++) {
    const segStart = road.points[i];
    const segEnd = road.points[i + 1];
    const segVec = normalize(segEnd.x - segStart.x, segEnd.y - segStart.y);
    if (segVec.len < EPSILON) continue;

    const parallel = Math.abs(dot(edgeVec.x, edgeVec.y, segVec.x, segVec.y));
    if (parallel < minParallel) continue;

    const distance = segmentToSegmentDistance(edgeStart, edgeEnd, segStart, segEnd);
    if (!Number.isFinite(distance) || distance > maxDistance) continue;

    if (distance < bestDistance || (Math.abs(distance - bestDistance) < 1e-6 && parallel > bestParallel)) {
      bestDistance = distance;
      bestParallel = parallel;
    }
  }

  if (!Number.isFinite(bestDistance)) return null;
  return { distance: bestDistance, parallel: bestParallel, road };
}

export function inferRoadEdgesFromLines(
  vertices: Point2D[],
  roadLines: LocalRoadLine[],
  options: InferRoadOptions = {},
): InferredRoadEdge[] {
  if (!Array.isArray(vertices) || vertices.length < 3) return [];
  if (!Array.isArray(roadLines) || roadLines.length === 0) return [];

  const maxDistance = options.maxDistance ?? 20;
  const minParallel = options.minParallel ?? 0.55;
  const maxEdges = Math.max(1, Math.min(options.maxEdges ?? 4, vertices.length));

  const inferred: Array<InferredRoadEdge & { score: number }> = [];
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const edgeStart = vertices[i];
    const edgeEnd = vertices[j];

    let best: EdgeEvaluation | null = null;
    for (const road of roadLines) {
      const evaluated = evaluateEdgeAgainstRoad(edgeStart, edgeEnd, road, maxDistance, minParallel);
      if (!evaluated) continue;
      if (!best) {
        best = evaluated;
        continue;
      }

      const evaluatedScore = evaluated.distance / (0.5 + evaluated.parallel);
      const bestScore = best.distance / (0.5 + best.parallel);
      if (evaluatedScore < bestScore) best = evaluated;
    }

    if (!best) continue;

    const direction = edgeDirectionByMidpoint(vertices, edgeStart, edgeEnd);
    const width = Number.isFinite(best.road.width) && best.road.width > 0
      ? best.road.width
      : 6;
    const score = best.distance / (0.5 + best.parallel);
    inferred.push({
      edgeVertexIndices: [i, j],
      width,
      distance: best.distance,
      direction,
      name: best.road.name,
      highway: best.road.highway,
      score,
    });
  }

  inferred.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 1e-6) return a.score - b.score;
    if (Math.abs(a.distance - b.distance) > 1e-6) return a.distance - b.distance;
    return a.edgeVertexIndices[0] - b.edgeVertexIndices[0];
  });

  // Keep edge assignments unique while preserving best match order.
  const seen = new Set<number>();
  const unique: InferredRoadEdge[] = [];
  for (const item of inferred) {
    const edgeId = item.edgeVertexIndices[0];
    if (seen.has(edgeId)) continue;
    seen.add(edgeId);
    unique.push({
      edgeVertexIndices: item.edgeVertexIndices,
      width: item.width,
      distance: item.distance,
      direction: item.direction,
      name: item.name,
      highway: item.highway,
    });
    if (unique.length >= maxEdges) break;
  }

  return unique;
}

export function inferRoadEdgesFromGeometry(
  vertices: Point2D[],
  maxEdges: number = 2,
): InferredRoadEdge[] {
  if (!Array.isArray(vertices) || vertices.length < 2) return [];

  const ranked = vertices.map((start, i) => {
    const j = (i + 1) % vertices.length;
    const end = vertices[j];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    return {
      edgeVertexIndices: [i, j] as [number, number],
      length,
      direction: edgeDirectionByMidpoint(vertices, start, end),
    };
  }).sort((a, b) => b.length - a.length);

  const selected: InferredRoadEdge[] = [];
  const usedDirections = new Set<string>();
  for (const edge of ranked) {
    if (selected.length >= Math.max(1, Math.min(maxEdges, vertices.length))) break;
    if (usedDirections.has(edge.direction) && selected.length + 1 < maxEdges) continue;

    selected.push({
      edgeVertexIndices: edge.edgeVertexIndices,
      width: 6,
      distance: 0,
      direction: edge.direction,
    });
    usedDirections.add(edge.direction);
  }

  return selected;
}
