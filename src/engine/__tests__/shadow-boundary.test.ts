import { buildShadowBoundary, buildShadowMeasurementLine } from '../shadow-boundary';
import type { Point2D, Road } from '../types';

const siteVertices: Point2D[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('shadow boundary helpers', () => {
  it('pushes a road-facing edge outward by the actual road width', () => {
    const northRoad: Road = {
      edgeStart: { x: 10, y: 10 },
      edgeEnd: { x: 0, y: 10 },
      width: 4,
      centerOffset: 2,
      bearing: 0,
    };

    const boundary = buildShadowBoundary(siteVertices, [northRoad]);
    expect(Math.max(...boundary.map((point) => point.y))).toBeCloseTo(14, 5);
  });

  it('adds the 5m measurement offset on top of the deemed road boundary', () => {
    const northRoad: Road = {
      edgeStart: { x: 10, y: 10 },
      edgeEnd: { x: 0, y: 10 },
      width: 4,
      centerOffset: 2,
      bearing: 0,
    };

    const line5m = buildShadowMeasurementLine(siteVertices, [northRoad], 5);
    expect(Math.max(...line5m.map((point) => point.y))).toBeCloseTo(19, 5);
  });
});
