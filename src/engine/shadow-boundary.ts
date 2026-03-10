import type { Point2D, Road } from './types';
import { distanceToSegment } from './geometry';

interface OffsetLine {
  point: Point2D;
  direction: Point2D;
}

function signedArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function lineIntersection(a: OffsetLine, b: OffsetLine): Point2D | null {
  const det = a.direction.x * b.direction.y - a.direction.y * b.direction.x;
  if (Math.abs(det) < 1e-10) return null;

  const dx = b.point.x - a.point.x;
  const dy = b.point.y - a.point.y;
  const t = (dx * b.direction.y - dy * b.direction.x) / det;
  return {
    x: a.point.x + a.direction.x * t,
    y: a.point.y + a.direction.y * t,
  };
}

function outwardNormal(a: Point2D, b: Point2D, isCCW: boolean): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-10) return { x: 0, y: 0 };
  return isCCW
    ? { x: dy / len, y: -dx / len }
    : { x: -dy / len, y: dx / len };
}

function buildOffsetLine(a: Point2D, b: Point2D, offset: number, isCCW: boolean): OffsetLine {
  const normal = outwardNormal(a, b, isCCW);
  return {
    point: {
      x: a.x + normal.x * offset,
      y: a.y + normal.y * offset,
    },
    direction: {
      x: b.x - a.x,
      y: b.y - a.y,
    },
  };
}

function matchRoadWidth(edgeStart: Point2D, edgeEnd: Point2D, roads: Road[]): number {
  const samples: Point2D[] = [
    edgeStart,
    { x: (edgeStart.x + edgeEnd.x) / 2, y: (edgeStart.y + edgeEnd.y) / 2 },
    edgeEnd,
  ];
  const tolerance = 0.5;

  for (const road of roads) {
    let matches = 0;
    for (const sample of samples) {
      if (distanceToSegment(sample, road.edgeStart, road.edgeEnd) < tolerance) {
        matches++;
      }
    }
    if (matches >= 2) {
      return Math.max(0, road.width);
    }
  }

  return 0;
}

function applyEdgeOutsets(vertices: Point2D[], offsets: number[]): Point2D[] {
  if (vertices.length < 3 || offsets.length !== vertices.length) return vertices;
  if (offsets.every((offset) => Math.abs(offset) < 1e-9)) return vertices;

  const n = vertices.length;
  const isCCW = signedArea(vertices) > 0;
  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];
    const prevOffset = offsets[(i - 1 + n) % n] ?? 0;
    const nextOffset = offsets[i] ?? 0;

    const prevLine = buildOffsetLine(prev, curr, prevOffset, isCCW);
    const nextLine = buildOffsetLine(curr, next, nextOffset, isCCW);
    const intersection = lineIntersection(prevLine, nextLine);

    if (intersection) {
      result.push(intersection);
      continue;
    }

    const prevNormal = outwardNormal(prev, curr, isCCW);
    const nextNormal = outwardNormal(curr, next, isCCW);
    result.push({
      x: curr.x + prevNormal.x * prevOffset + nextNormal.x * nextOffset,
      y: curr.y + prevNormal.y * prevOffset + nextNormal.y * nextOffset,
    });
  }

  return result;
}

function getShadowBoundaryOffsets(vertices: Point2D[], roads: Road[]): number[] {
  const n = vertices.length;
  return Array.from({ length: n }, (_, index) =>
    matchRoadWidth(vertices[index], vertices[(index + 1) % n], roads),
  );
}

export function buildShadowBoundary(vertices: Point2D[], roads: Road[]): Point2D[] {
  return applyEdgeOutsets(vertices, getShadowBoundaryOffsets(vertices, roads));
}

export function buildShadowMeasurementLine(
  vertices: Point2D[],
  roads: Road[],
  offset: number,
): Point2D[] {
  const boundaryOffsets = getShadowBoundaryOffsets(vertices, roads);
  return applyEdgeOutsets(
    vertices,
    boundaryOffsets.map((boundaryOffset) => boundaryOffset + offset),
  );
}

export function offsetShadowBoundary(boundaryVertices: Point2D[], offset: number): Point2D[] {
  return applyEdgeOutsets(
    boundaryVertices,
    Array(boundaryVertices.length).fill(offset),
  );
}
