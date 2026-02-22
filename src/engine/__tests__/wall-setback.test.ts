import { applyWallSetback } from '../wall-setback';
import type { Point2D } from '../types';

describe('applyWallSetback', () => {
  const rectangle: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ];

  describe('null or zero setback', () => {
    it('returns original vertices when setback is null', () => {
      const result = applyWallSetback(rectangle, null);
      expect(result).toEqual(rectangle);
    });

    it('returns original vertices when setback is 0', () => {
      const result = applyWallSetback(rectangle, 0);
      expect(result).toEqual(rectangle);
    });

    it('returns exact same reference when setback is null', () => {
      const result = applyWallSetback(rectangle, null);
      expect(result).toBe(rectangle);
    });
  });

  describe('insets rectangle by 1m on all sides', () => {
    it('reduces a 10x15 rectangle to 8x13 with 1m setback', () => {
      const result = applyWallSetback(rectangle, 1);
      expect(result).toHaveLength(4);

      // Expected inset: (1,1), (9,1), (9,14), (1,14)
      expect(result[0].x).toBeCloseTo(1, 5);
      expect(result[0].y).toBeCloseTo(1, 5);
      expect(result[1].x).toBeCloseTo(9, 5);
      expect(result[1].y).toBeCloseTo(1, 5);
      expect(result[2].x).toBeCloseTo(9, 5);
      expect(result[2].y).toBeCloseTo(14, 5);
      expect(result[3].x).toBeCloseTo(1, 5);
      expect(result[3].y).toBeCloseTo(14, 5);
    });

    it('inset polygon has smaller area than original', () => {
      const result = applyWallSetback(rectangle, 1);
      // Original area = 150, inset area = 8 * 13 = 104
      const insetArea = computeArea(result);
      expect(insetArea).toBeCloseTo(104, 1);
      expect(insetArea).toBeLessThan(150);
    });
  });

  describe('insets rectangle by 1.5m', () => {
    it('reduces a 10x15 rectangle to 7x12 with 1.5m setback', () => {
      const result = applyWallSetback(rectangle, 1.5);
      expect(result).toHaveLength(4);

      expect(result[0].x).toBeCloseTo(1.5, 5);
      expect(result[0].y).toBeCloseTo(1.5, 5);
      expect(result[1].x).toBeCloseTo(8.5, 5);
      expect(result[1].y).toBeCloseTo(1.5, 5);
      expect(result[2].x).toBeCloseTo(8.5, 5);
      expect(result[2].y).toBeCloseTo(13.5, 5);
      expect(result[3].x).toBeCloseTo(1.5, 5);
      expect(result[3].y).toBeCloseTo(13.5, 5);
    });
  });

  describe('insets a square by 2m', () => {
    it('reduces a 10x10 square to 6x6', () => {
      const square: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      const result = applyWallSetback(square, 2);
      expect(result).toHaveLength(4);

      expect(result[0].x).toBeCloseTo(2, 5);
      expect(result[0].y).toBeCloseTo(2, 5);
      expect(result[1].x).toBeCloseTo(8, 5);
      expect(result[1].y).toBeCloseTo(2, 5);
      expect(result[2].x).toBeCloseTo(8, 5);
      expect(result[2].y).toBeCloseTo(8, 5);
      expect(result[3].x).toBeCloseTo(2, 5);
      expect(result[3].y).toBeCloseTo(8, 5);

      const insetArea = computeArea(result);
      expect(insetArea).toBeCloseTo(36, 1);
    });
  });

  describe('preserves vertex count', () => {
    it('returns same number of vertices for a triangle', () => {
      const triangle: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      const result = applyWallSetback(triangle, 1);
      expect(result).toHaveLength(3);
    });

    it('returns same number of vertices for a pentagon', () => {
      const pentagon: Point2D[] = [
        { x: 5, y: 0 },
        { x: 10, y: 4 },
        { x: 8, y: 10 },
        { x: 2, y: 10 },
        { x: 0, y: 4 },
      ];
      const result = applyWallSetback(pentagon, 1);
      expect(result).toHaveLength(5);
    });
  });

  describe('produces inward-offset polygon', () => {
    it('all inset vertices are inside the original rectangle', () => {
      const result = applyWallSetback(rectangle, 1);
      for (const v of result) {
        expect(v.x).toBeGreaterThan(0);
        expect(v.x).toBeLessThan(10);
        expect(v.y).toBeGreaterThan(0);
        expect(v.y).toBeLessThan(15);
      }
    });

    it('larger setback produces smaller polygon', () => {
      const small = applyWallSetback(rectangle, 0.5);
      const large = applyWallSetback(rectangle, 2);
      const areaSmall = computeArea(small);
      const areaLarge = computeArea(large);
      expect(areaLarge).toBeLessThan(areaSmall);
    });
  });
});

/** Helper: Shoelace formula for polygon area */
function computeArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}
