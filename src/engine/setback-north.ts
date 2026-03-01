import type { Point2D } from './types';
import { distanceToSegment } from './geometry';

/**
 * Calculate max allowed height at a point due to north side
 * setback regulation (北側斜線制限).
 *
 * height = riseHeight + dist * slopeRatio
 *
 * Only applies to low-rise residential and mid-rise residential zones.
 * riseHeight is 5m for low-rise, 10m for mid-rise.
 * slopeRatio is always 1.25.
 */
export function calculateNorthSetbackHeight(
  point: Point2D,
  northBoundaryStart: Point2D,
  northBoundaryEnd: Point2D,
  riseHeight: number,
  slopeRatio: number,
): number {
  const dist = distanceToSegment(point, northBoundaryStart, northBoundaryEnd);
  return riseHeight + dist * slopeRatio;
}
