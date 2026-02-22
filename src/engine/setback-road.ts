import type { Point2D, Road } from './types';
import { distanceToSegment } from './geometry';

/**
 * Calculate max allowed height at a point due to a single road's
 * setback regulation (道路斜線制限).
 *
 * height = (distance from opposite side of road) * slopeRatio
 *
 * If the point is beyond the application distance from the road boundary,
 * the restriction does not apply (returns Infinity).
 */
export function calculateRoadSetbackHeight(
  point: Point2D,
  road: Road,
  slopeRatio: number,
  applicationDistance?: number,
): number {
  const distFromBoundary = distanceToSegment(point, road.edgeStart, road.edgeEnd);
  if (applicationDistance !== undefined && distFromBoundary > applicationDistance) {
    return Infinity;
  }
  const distFromOpposite = distFromBoundary + road.width;
  return distFromOpposite * slopeRatio;
}

/**
 * Calculate the most restrictive road setback height at a point,
 * considering all adjacent roads.
 */
export function calculateMinRoadSetbackHeight(
  point: Point2D,
  roads: Road[],
  slopeRatio: number,
  applicationDistance?: number,
): number {
  if (roads.length === 0) return Infinity;
  return Math.min(
    ...roads.map((road) =>
      calculateRoadSetbackHeight(point, road, slopeRatio, applicationDistance),
    ),
  );
}
