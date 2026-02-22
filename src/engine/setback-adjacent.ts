import type { Point2D } from './types';
import { distanceToSegment } from './geometry';

/**
 * Calculate max allowed height at a point due to the adjacent land
 * setback regulation (隣地斜線制限).
 *
 * height = riseHeight + dist * slopeRatio
 *
 * riseHeight is 20m for residential zones, 31m for others.
 * slopeRatio is 1.25 for residential zones, 2.5 for others.
 */
export function calculateAdjacentSetbackHeight(
  point: Point2D,
  boundaryStart: Point2D,
  boundaryEnd: Point2D,
  riseHeight: number,
  slopeRatio: number,
): number {
  const dist = distanceToSegment(point, boundaryStart, boundaryEnd);
  return riseHeight + dist * slopeRatio;
}
