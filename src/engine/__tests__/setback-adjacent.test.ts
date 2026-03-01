import { calculateAdjacentSetbackHeight } from '../setback-adjacent';
import type { Point2D } from '../types';

const boundaryStart: Point2D = { x: 10, y: 0 };
const boundaryEnd: Point2D = { x: 10, y: 15 };

describe('calculateAdjacentSetbackHeight', () => {
  describe('residential parameters (riseHeight=20, slopeRatio=1.25)', () => {
    const riseHeight = 20;
    const slopeRatio = 1.25;

    it('returns riseHeight at the boundary (distance = 0)', () => {
      const point: Point2D = { x: 10, y: 7.5 };
      // dist = 0, height = 20 + 0 * 1.25 = 20
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(20, 10);
    });

    it('calculates height at 1m from boundary', () => {
      const point: Point2D = { x: 9, y: 7.5 };
      // dist = 1, height = 20 + 1 * 1.25 = 21.25
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(21.25, 10);
    });

    it('calculates height at 5m from boundary', () => {
      const point: Point2D = { x: 5, y: 7.5 };
      // dist = 5, height = 20 + 5 * 1.25 = 26.25
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(26.25, 10);
    });

    it('calculates height at 10m from boundary', () => {
      const point: Point2D = { x: 0, y: 7.5 };
      // dist = 10, height = 20 + 10 * 1.25 = 32.5
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(32.5, 10);
    });

    it('height increases linearly with distance', () => {
      const h0 = calculateAdjacentSetbackHeight(
        { x: 10, y: 7.5 },
        boundaryStart,
        boundaryEnd,
        riseHeight,
        slopeRatio,
      );
      const h3 = calculateAdjacentSetbackHeight(
        { x: 7, y: 7.5 },
        boundaryStart,
        boundaryEnd,
        riseHeight,
        slopeRatio,
      );
      const h6 = calculateAdjacentSetbackHeight(
        { x: 4, y: 7.5 },
        boundaryStart,
        boundaryEnd,
        riseHeight,
        slopeRatio,
      );
      expect(h3 - h0).toBeCloseTo(h6 - h3, 10);
    });
  });

  describe('commercial parameters (riseHeight=31, slopeRatio=2.5)', () => {
    const riseHeight = 31;
    const slopeRatio = 2.5;

    it('returns riseHeight at the boundary (distance = 0)', () => {
      const point: Point2D = { x: 10, y: 7.5 };
      // dist = 0, height = 31 + 0 * 2.5 = 31
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(31, 10);
    });

    it('calculates height at 1m from boundary', () => {
      const point: Point2D = { x: 9, y: 7.5 };
      // dist = 1, height = 31 + 1 * 2.5 = 33.5
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(33.5, 10);
    });

    it('calculates height at 5m from boundary', () => {
      const point: Point2D = { x: 5, y: 7.5 };
      // dist = 5, height = 31 + 5 * 2.5 = 43.5
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(43.5, 10);
    });

    it('calculates height at 10m from boundary', () => {
      const point: Point2D = { x: 0, y: 7.5 };
      // dist = 10, height = 31 + 10 * 2.5 = 56
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, riseHeight, slopeRatio),
      ).toBeCloseTo(56, 10);
    });

    it('produces higher limits than residential at same distance', () => {
      const point: Point2D = { x: 5, y: 7.5 };
      const residential = calculateAdjacentSetbackHeight(
        point,
        boundaryStart,
        boundaryEnd,
        20,
        1.25,
      );
      const commercial = calculateAdjacentSetbackHeight(
        point,
        boundaryStart,
        boundaryEnd,
        31,
        2.5,
      );
      expect(commercial).toBeGreaterThan(residential);
    });
  });

  describe('boundary orientation', () => {
    it('works with a horizontal boundary', () => {
      const hStart: Point2D = { x: 0, y: 15 };
      const hEnd: Point2D = { x: 10, y: 15 };
      const point: Point2D = { x: 5, y: 12 };
      // dist = 3, height = 20 + 3 * 1.25 = 23.75
      expect(
        calculateAdjacentSetbackHeight(point, hStart, hEnd, 20, 1.25),
      ).toBeCloseTo(23.75, 10);
    });

    it('works with a diagonal boundary', () => {
      const dStart: Point2D = { x: 0, y: 0 };
      const dEnd: Point2D = { x: 10, y: 10 };
      const point: Point2D = { x: 0, y: 10 };
      // Distance from (0,10) to segment (0,0)-(10,10):
      // The line is y=x. Distance = |0-10|/sqrt(2) = 10/sqrt(2)
      // But segment is from (0,0) to (10,10), projection t = ((0*10)+(10*10))/200 = 100/200 = 0.5
      // proj = (5,5), dist = sqrt(25+25) = sqrt(50) = 5*sqrt(2)
      const expectedDist = 5 * Math.sqrt(2);
      const expectedHeight = 20 + expectedDist * 1.25;
      expect(
        calculateAdjacentSetbackHeight(point, dStart, dEnd, 20, 1.25),
      ).toBeCloseTo(expectedHeight, 10);
    });

    it('handles a point beyond the segment endpoint', () => {
      const point: Point2D = { x: 10, y: 20 };
      // Beyond the segment end (10,15). Nearest point = (10,15).
      // dist = sqrt(0+25) = 5
      // height = 20 + 5 * 1.25 = 26.25
      expect(
        calculateAdjacentSetbackHeight(point, boundaryStart, boundaryEnd, 20, 1.25),
      ).toBeCloseTo(26.25, 10);
    });
  });
});
