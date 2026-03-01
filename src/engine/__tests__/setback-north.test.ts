import { calculateNorthSetbackHeight } from '../setback-north';
import type { Point2D } from '../types';

// North boundary at y=15 (top of the site)
const northStart: Point2D = { x: 0, y: 15 };
const northEnd: Point2D = { x: 10, y: 15 };

describe('calculateNorthSetbackHeight', () => {
  describe('low-rise residential (riseHeight=5, slopeRatio=1.25)', () => {
    const riseHeight = 5;
    const slopeRatio = 1.25;

    it('returns riseHeight at the north boundary (distance = 0)', () => {
      const point: Point2D = { x: 5, y: 15 };
      // dist = 0, height = 5 + 0 * 1.25 = 5
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(5, 10);
    });

    it('calculates height at 1m from north boundary', () => {
      const point: Point2D = { x: 5, y: 14 };
      // dist = 1, height = 5 + 1 * 1.25 = 6.25
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(6.25, 10);
    });

    it('calculates height at 4m from north boundary', () => {
      const point: Point2D = { x: 5, y: 11 };
      // dist = 4, height = 5 + 4 * 1.25 = 10
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(10, 10);
    });

    it('calculates height at 10m from north boundary', () => {
      const point: Point2D = { x: 5, y: 5 };
      // dist = 10, height = 5 + 10 * 1.25 = 17.5
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(17.5, 10);
    });

    it('calculates height at 15m from north boundary (at south edge)', () => {
      const point: Point2D = { x: 5, y: 0 };
      // dist = 15, height = 5 + 15 * 1.25 = 23.75
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(23.75, 10);
    });

    it('height increases with distance from north boundary', () => {
      const h0 = calculateNorthSetbackHeight(
        { x: 5, y: 15 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );
      const h5 = calculateNorthSetbackHeight(
        { x: 5, y: 10 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );
      const h10 = calculateNorthSetbackHeight(
        { x: 5, y: 5 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );

      expect(h5).toBeGreaterThan(h0);
      expect(h10).toBeGreaterThan(h5);
    });

    it('height increase is linear (constant slope)', () => {
      const h0 = calculateNorthSetbackHeight(
        { x: 5, y: 15 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );
      const h3 = calculateNorthSetbackHeight(
        { x: 5, y: 12 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );
      const h6 = calculateNorthSetbackHeight(
        { x: 5, y: 9 },
        northStart,
        northEnd,
        riseHeight,
        slopeRatio,
      );
      // h3 - h0 should equal h6 - h3 (linear)
      expect(h3 - h0).toBeCloseTo(h6 - h3, 10);
    });
  });

  describe('mid-rise residential (riseHeight=10, slopeRatio=1.25)', () => {
    const riseHeight = 10;
    const slopeRatio = 1.25;

    it('returns riseHeight at the north boundary (distance = 0)', () => {
      const point: Point2D = { x: 5, y: 15 };
      // dist = 0, height = 10 + 0 * 1.25 = 10
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(10, 10);
    });

    it('calculates height at 1m from north boundary', () => {
      const point: Point2D = { x: 5, y: 14 };
      // dist = 1, height = 10 + 1 * 1.25 = 11.25
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(11.25, 10);
    });

    it('calculates height at 5m from north boundary', () => {
      const point: Point2D = { x: 5, y: 10 };
      // dist = 5, height = 10 + 5 * 1.25 = 16.25
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(16.25, 10);
    });

    it('calculates height at 10m from north boundary', () => {
      const point: Point2D = { x: 5, y: 5 };
      // dist = 10, height = 10 + 10 * 1.25 = 22.5
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(22.5, 10);
    });

    it('mid-rise allows higher buildings at boundary than low-rise', () => {
      const point: Point2D = { x: 5, y: 15 };
      const lowRise = calculateNorthSetbackHeight(point, northStart, northEnd, 5, 1.25);
      const midRise = calculateNorthSetbackHeight(point, northStart, northEnd, 10, 1.25);
      expect(midRise).toBeGreaterThan(lowRise);
      expect(midRise - lowRise).toBeCloseTo(5, 10); // difference is exactly the riseHeight delta
    });
  });

  describe('boundary orientation', () => {
    it('works with a diagonal north boundary', () => {
      const diagStart: Point2D = { x: 0, y: 12 };
      const diagEnd: Point2D = { x: 10, y: 15 };
      const point: Point2D = { x: 5, y: 10 };
      // The boundary is not perfectly horizontal, distance will vary
      const height = calculateNorthSetbackHeight(point, diagStart, diagEnd, 5, 1.25);
      expect(height).toBeGreaterThan(5); // Must be > riseHeight since dist > 0
    });

    it('handles a point at the boundary edge corner', () => {
      const point: Point2D = { x: 0, y: 15 };
      // Exactly on the north boundary start
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, 5, 1.25),
      ).toBeCloseTo(5, 10);
    });

    it('handles a point beyond the boundary segment', () => {
      const point: Point2D = { x: -5, y: 15 };
      // Beyond the segment start (0,15). Nearest is (0,15), dist = 5
      // height = 5 + 5 * 1.25 = 11.25
      expect(
        calculateNorthSetbackHeight(point, northStart, northEnd, 5, 1.25),
      ).toBeCloseTo(11.25, 10);
    });
  });
});
