import type { Point2D, Road } from './types';
import { distanceToSegment } from './geometry';

/**
 * Calculate max allowed height at a point due to a single road's
 * setback regulation (道路斜線制限).
 *
 * height = (distance from opposite side of deemed road) * slopeRatio
 *
 * For narrow roads (< 4m), the 'deemed road' (みなし道路) is treated as 4m wide.
 * The building must set back from the original boundary by setbackDistance,
 * and the slope is measured from the opposite side of the deemed road.
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

  // For narrow roads (<4m), use deemed road width of 4m (center-line setback)
  const setbackDistance = road.width < 4 ? (4 - road.width) / 2 : 0;
  const effectiveRoadWidth = Math.max(road.width, 4);

  // Points within setback area get height 0 (cannot build)
  if (setbackDistance > 0 && distFromBoundary < setbackDistance) {
    return 0;
  }

  // Distance from the far side of the (deemed) road
  const distFromOpposite = (distFromBoundary - setbackDistance) + effectiveRoadWidth;
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
