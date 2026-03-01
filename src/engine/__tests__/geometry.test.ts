import { distanceToSegment, polygonArea, isInsidePolygon } from '../geometry';
import type { Point2D } from '../types';

describe('distanceToSegment', () => {
  it('returns 0 when point is on the segment start', () => {
    const p: Point2D = { x: 0, y: 0 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    expect(distanceToSegment(p, a, b)).toBe(0);
  });

  it('returns 0 when point is on the segment end', () => {
    const p: Point2D = { x: 10, y: 0 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    expect(distanceToSegment(p, a, b)).toBe(0);
  });

  it('returns 0 when point is on the segment midpoint', () => {
    const p: Point2D = { x: 5, y: 0 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    expect(distanceToSegment(p, a, b)).toBe(0);
  });

  it('returns perpendicular distance when projection falls on segment', () => {
    const p: Point2D = { x: 5, y: 3 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    expect(distanceToSegment(p, a, b)).toBeCloseTo(3, 10);
  });

  it('returns distance to nearest endpoint when projection falls before segment', () => {
    const p: Point2D = { x: -3, y: 4 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    // Distance to a = sqrt(9+16) = 5
    expect(distanceToSegment(p, a, b)).toBeCloseTo(5, 10);
  });

  it('returns distance to nearest endpoint when projection falls beyond segment', () => {
    const p: Point2D = { x: 13, y: 4 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 10, y: 0 };
    // Distance to b = sqrt(9+16) = 5
    expect(distanceToSegment(p, a, b)).toBeCloseTo(5, 10);
  });

  it('handles zero-length segment (a === b)', () => {
    const p: Point2D = { x: 3, y: 4 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 0, y: 0 };
    // Distance to the point = sqrt(9+16) = 5
    expect(distanceToSegment(p, a, b)).toBeCloseTo(5, 10);
  });

  it('calculates distance to a diagonal segment', () => {
    const p: Point2D = { x: 0, y: 0 };
    const a: Point2D = { x: 1, y: 1 };
    const b: Point2D = { x: 3, y: 3 };
    // The line is y=x. Perpendicular distance from origin = 0/sqrt(2)... wait
    // The projection of (0,0) onto line from (1,1)-(3,3): t = ((0-1)*2 + (0-1)*2)/(4+4) = -4/8 = -0.5 -> clamped to 0
    // So nearest point is (1,1), distance = sqrt(2)
    expect(distanceToSegment(p, a, b)).toBeCloseTo(Math.sqrt(2), 10);
  });

  it('handles vertical segment', () => {
    const p: Point2D = { x: 7, y: 5 };
    const a: Point2D = { x: 3, y: 0 };
    const b: Point2D = { x: 3, y: 10 };
    // Perpendicular distance = |7-3| = 4
    expect(distanceToSegment(p, a, b)).toBeCloseTo(4, 10);
  });

  it('handles a point directly beside the segment', () => {
    const p: Point2D = { x: -2, y: 5 };
    const a: Point2D = { x: 0, y: 0 };
    const b: Point2D = { x: 0, y: 10 };
    expect(distanceToSegment(p, a, b)).toBeCloseTo(2, 10);
  });
});

describe('polygonArea', () => {
  it('calculates the area of a unit square', () => {
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(1, 10);
  });

  it('calculates the area of a 10x15 rectangle', () => {
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 15 },
      { x: 0, y: 15 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(150, 10);
  });

  it('calculates the area of a right triangle', () => {
    // Triangle with base 6, height 4 => area = 12
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 4 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(12, 10);
  });

  it('returns the same area regardless of winding order', () => {
    const cw: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const ccw: Point2D[] = [...cw].reverse();
    expect(polygonArea(cw)).toBeCloseTo(polygonArea(ccw), 10);
  });

  it('calculates the area of an L-shaped polygon', () => {
    // An L-shape: 10x10 square with 5x5 cut from top-right = 100 - 25 = 75
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(75, 10);
  });

  it('returns 0 for a degenerate polygon (all points collinear)', () => {
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(0, 10);
  });

  it('calculates area of an irregular quadrilateral', () => {
    // Trapezoid: bases 10 and 6, height 4 => area = (10+6)/2 * 4 = 32
    const vertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 8, y: 4 },
      { x: 2, y: 4 },
    ];
    expect(polygonArea(vertices)).toBeCloseTo(32, 10);
  });
});

describe('isInsidePolygon', () => {
  const square: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('returns true for a point clearly inside the polygon', () => {
    expect(isInsidePolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('returns true for a point near an edge but inside', () => {
    expect(isInsidePolygon({ x: 0.1, y: 0.1 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside the polygon', () => {
    expect(isInsidePolygon({ x: 15, y: 5 }, square)).toBe(false);
  });

  it('returns false for a point far away', () => {
    expect(isInsidePolygon({ x: -100, y: -100 }, square)).toBe(false);
  });

  it('returns false for a point above the polygon', () => {
    expect(isInsidePolygon({ x: 5, y: 11 }, square)).toBe(false);
  });

  it('returns false for a point below the polygon', () => {
    expect(isInsidePolygon({ x: 5, y: -1 }, square)).toBe(false);
  });

  it('returns false for a point to the left of the polygon', () => {
    expect(isInsidePolygon({ x: -1, y: 5 }, square)).toBe(false);
  });

  it('works with a triangular polygon', () => {
    const triangle: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(isInsidePolygon({ x: 5, y: 3 }, triangle)).toBe(true);
    expect(isInsidePolygon({ x: 1, y: 9 }, triangle)).toBe(false);
  });

  it('works with a concave polygon', () => {
    // Arrow/chevron shape pointing right: vertices form a concave notch on the left
    const concave: Point2D[] = [
      { x: 0, y: 0 },
      { x: 6, y: 4 },
      { x: 0, y: 8 },
      { x: 3, y: 4 },
    ];
    // Point in the concave notch (between left edge and the indent) is outside
    expect(isInsidePolygon({ x: 1, y: 4 }, concave)).toBe(false);
    // Point on the right side of the arrow (in the upper or lower lobe) is inside
    expect(isInsidePolygon({ x: 4, y: 3 }, concave)).toBe(true);
    // Point outside entirely to the right
    expect(isInsidePolygon({ x: 7, y: 4 }, concave)).toBe(false);
  });

  it('works with the standard 10x15 site boundary', () => {
    const site: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 15 },
      { x: 0, y: 15 },
    ];
    expect(isInsidePolygon({ x: 5, y: 7.5 }, site)).toBe(true);
    expect(isInsidePolygon({ x: -1, y: 7.5 }, site)).toBe(false);
    expect(isInsidePolygon({ x: 11, y: 7.5 }, site)).toBe(false);
  });
});
