import {
  calculateRoadSetbackHeight,
  calculateMinRoadSetbackHeight,
} from '../setback-road';
import type { Point2D, Road } from '../types';

const road: Road = {
  edgeStart: { x: 0, y: 0 },
  edgeEnd: { x: 10, y: 0 },
  width: 6,
  centerOffset: 3,
  bearing: 180,
};

describe('calculateRoadSetbackHeight', () => {
  it('returns height at road boundary (distance 0 from edge)', () => {
    const point: Point2D = { x: 5, y: 0 };
    // distance from boundary = 0, distance from opposite = 0 + 6 = 6
    // height = 6 * 1.25 = 7.5
    expect(calculateRoadSetbackHeight(point, road, 1.25)).toBeCloseTo(7.5, 10);
  });

  it('height increases with distance from boundary', () => {
    const atBoundary: Point2D = { x: 5, y: 0 };
    const at3m: Point2D = { x: 5, y: 3 };
    const at5m: Point2D = { x: 5, y: 5 };

    const h0 = calculateRoadSetbackHeight(atBoundary, road, 1.25);
    const h3 = calculateRoadSetbackHeight(at3m, road, 1.25);
    const h5 = calculateRoadSetbackHeight(at5m, road, 1.25);

    expect(h3).toBeGreaterThan(h0);
    expect(h5).toBeGreaterThan(h3);
  });

  it('calculates correct height at 5m from boundary', () => {
    const point: Point2D = { x: 5, y: 5 };
    // distance from boundary = 5, distance from opposite = 5 + 6 = 11
    // height = 11 * 1.25 = 13.75
    expect(calculateRoadSetbackHeight(point, road, 1.25)).toBeCloseTo(13.75, 10);
  });

  it('calculates correct height at 10m from boundary', () => {
    const point: Point2D = { x: 5, y: 10 };
    // distance from boundary = 10, distance from opposite = 10 + 6 = 16
    // height = 16 * 1.25 = 20
    expect(calculateRoadSetbackHeight(point, road, 1.25)).toBeCloseTo(20, 10);
  });

  it('returns Infinity when beyond application distance', () => {
    const point: Point2D = { x: 5, y: 25 };
    // distance from boundary = 25, applicationDistance = 20
    const height = calculateRoadSetbackHeight(point, road, 1.25, 20);
    expect(height).toBe(Infinity);
  });

  it('applies restriction at exactly the application distance', () => {
    const point: Point2D = { x: 5, y: 20 };
    // distance from boundary = 20, applicationDistance = 20
    // 20 is NOT > 20, so restriction still applies
    // distance from opposite = 20 + 6 = 26
    // height = 26 * 1.25 = 32.5
    const height = calculateRoadSetbackHeight(point, road, 1.25, 20);
    expect(height).toBeCloseTo(32.5, 10);
  });

  it('returns non-Infinity just inside the application distance', () => {
    const point: Point2D = { x: 5, y: 19.9 };
    const height = calculateRoadSetbackHeight(point, road, 1.25, 20);
    expect(height).not.toBe(Infinity);
    expect(height).toBeGreaterThan(0);
  });

  it('uses slopeRatio 1.5 for non-residential zones', () => {
    const point: Point2D = { x: 5, y: 0 };
    // distance from opposite = 0 + 6 = 6
    // height = 6 * 1.5 = 9
    expect(calculateRoadSetbackHeight(point, road, 1.5)).toBeCloseTo(9, 10);
  });

  it('returns Infinity when no application distance is specified and point is far', () => {
    const point: Point2D = { x: 5, y: 100 };
    // No applicationDistance => no distance check => always applies
    // distance from opposite = 100 + 6 = 106
    // height = 106 * 1.25 = 132.5
    const height = calculateRoadSetbackHeight(point, road, 1.25);
    expect(height).toBeCloseTo(132.5, 10);
  });

  it('handles a point at the corner of the road edge', () => {
    const point: Point2D = { x: 0, y: 0 };
    // distance from boundary = 0 (on the segment start)
    // distance from opposite = 0 + 6 = 6
    // height = 6 * 1.25 = 7.5
    expect(calculateRoadSetbackHeight(point, road, 1.25)).toBeCloseTo(7.5, 10);
  });

  it('handles a wider road (12m)', () => {
    const wideRoad: Road = {
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 10, y: 0 },
      width: 12,
      centerOffset: 6,
      bearing: 180,
    };
    const point: Point2D = { x: 5, y: 0 };
    // distance from opposite = 0 + 12 = 12
    // height = 12 * 1.25 = 15
    expect(calculateRoadSetbackHeight(point, wideRoad, 1.25)).toBeCloseTo(15, 10);
  });

  it('adds front-setback relief to the deemed opposite-side reference line', () => {
    const adjustedRoad: Road = {
      ...road,
      width: 4,
      centerOffset: 2,
      frontSetback: 1,
    };

    expect(
      calculateRoadSetbackHeight({ x: 5, y: 1 }, adjustedRoad, 1.25),
    ).toBeCloseTo(7.5, 10);
  });

  it('adds road-facing wall-setback relief when explicitly provided', () => {
    const point: Point2D = { x: 5, y: 1 };

    expect(calculateRoadSetbackHeight(point, { ...road, width: 4, centerOffset: 2 }, 1.25))
      .toBeCloseTo(6.25, 10);
    expect(
      calculateRoadSetbackHeight(
        point,
        { ...road, width: 4, centerOffset: 2 },
        1.25,
        undefined,
        { setbackRelief: 1 },
      ),
    ).toBeCloseTo(7.5, 10);
  });
});

describe('calculateMinRoadSetbackHeight', () => {
  it('returns Infinity when no roads exist', () => {
    const point: Point2D = { x: 5, y: 5 };
    expect(calculateMinRoadSetbackHeight(point, [], 1.25)).toBe(Infinity);
  });

  it('returns the height for a single road', () => {
    const point: Point2D = { x: 5, y: 5 };
    // distance from boundary = 5, distance from opposite = 11
    // height = 11 * 1.25 = 13.75
    expect(calculateMinRoadSetbackHeight(point, [road], 1.25)).toBeCloseTo(13.75, 10);
  });

  it('returns the minimum height across multiple roads', () => {
    const northRoad: Road = {
      edgeStart: { x: 0, y: 15 },
      edgeEnd: { x: 10, y: 15 },
      width: 4,
      centerOffset: 2,
      bearing: 0,
    };
    const point: Point2D = { x: 5, y: 5 };
    // Road 1 (south): dist=5, opposite=11, h=11*1.25=13.75
    // Road 2 (north): dist=10, opposite=14, h=14*1.25=17.5
    // Minimum = 13.75
    expect(calculateMinRoadSetbackHeight(point, [road, northRoad], 1.25)).toBeCloseTo(
      13.75,
      10,
    );
  });

  it('applies 2A/35m relief only when the point is beyond 10m from the other road centerline', () => {
    const narrowRoad: Road = {
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 30, y: 0 },
      width: 4,
      centerOffset: 2,
      bearing: 180,
    };
    const wideRoad: Road = {
      edgeStart: { x: 0, y: 20 },
      edgeEnd: { x: 0, y: 0 },
      width: 8,
      centerOffset: 4,
      bearing: 270,
      enableTwoA35m: true,
    };

    expect(
      calculateMinRoadSetbackHeight({ x: 11, y: 9 }, [narrowRoad, wideRoad], 1.25, 25),
    ).toBeCloseTo(21.25, 10);
    expect(
      calculateMinRoadSetbackHeight({ x: 5, y: 5 }, [narrowRoad, wideRoad], 1.25, 25),
    ).toBeCloseTo(11.25, 10);
  });

  it('ignores roads beyond application distance', () => {
    const farRoad: Road = {
      edgeStart: { x: 0, y: 100 },
      edgeEnd: { x: 10, y: 100 },
      width: 6,
      centerOffset: 3,
      bearing: 0,
    };
    const point: Point2D = { x: 5, y: 5 };
    // Road 1 (south): dist=5, h=11*1.25=13.75 (within 20m)
    // Road 2 (far north): dist=95, beyond applicationDistance=20 => Infinity
    // Min(13.75, Infinity) = 13.75
    expect(
      calculateMinRoadSetbackHeight(point, [road, farRoad], 1.25, 20),
    ).toBeCloseTo(13.75, 10);
  });

  it('returns Infinity when all roads are beyond application distance', () => {
    const farRoad: Road = {
      edgeStart: { x: 0, y: 100 },
      edgeEnd: { x: 10, y: 100 },
      width: 6,
      centerOffset: 3,
      bearing: 0,
    };
    const point: Point2D = { x: 5, y: 50 };
    // Both roads beyond 20m application distance
    expect(
      calculateMinRoadSetbackHeight(point, [farRoad], 1.25, 20),
    ).toBe(Infinity);
  });
});
