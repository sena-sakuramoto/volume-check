import type { Point2D, HeightDistrict } from './types';
import { distanceToSegment } from './geometry';

/**
 * Height district parameters for Tokyo-style regulations.
 *
 * 第一種: Very strict low-rise areas (7m at boundary + 0.6 slope, max 20m)
 * 第二種: Medium restriction (12m at boundary + 0.6 slope, max 25m)
 * 第三種: Less strict (15m at boundary + 0.6 slope, max 30m)
 */
interface HeightDistrictParams {
  maxAtBoundary: number;
  slope: number;
  absoluteMax: number;
}

const HEIGHT_DISTRICT_PARAMS: Record<string, HeightDistrictParams> = {
  '第一種': { maxAtBoundary: 7, slope: 0.6, absoluteMax: 20 },
  '第二種': { maxAtBoundary: 12, slope: 0.6, absoluteMax: 25 },
  '第三種': { maxAtBoundary: 15, slope: 0.6, absoluteMax: 30 },
};

/**
 * Calculate the max allowed height at a point due to height district regulation.
 * The limit is: maxAtBoundary + distance * slope, capped at absoluteMax.
 * Returns Infinity if no height district is designated.
 */
export function calculateHeightDistrictLimit(
  point: Point2D,
  boundaryStart: Point2D,
  boundaryEnd: Point2D,
  heightDistrict: HeightDistrict,
): number {
  if (heightDistrict.type === '指定なし') return Infinity;

  const params = HEIGHT_DISTRICT_PARAMS[heightDistrict.type];
  if (!params) return Infinity;

  // Use custom params if provided, otherwise defaults
  const maxAtBoundary = heightDistrict.maxHeightAtBoundary ?? params.maxAtBoundary;
  const slope = heightDistrict.slopeRatio ?? params.slope;
  const absoluteMax = heightDistrict.absoluteMax ?? params.absoluteMax;

  const dist = distanceToSegment(point, boundaryStart, boundaryEnd);
  const fromSlope = maxAtBoundary + dist * slope;
  return Math.min(fromSlope, absoluteMax);
}

/**
 * Get default height district parameters for a given type.
 */
export function getHeightDistrictParams(type: string): HeightDistrictParams | null {
  return HEIGHT_DISTRICT_PARAMS[type] ?? null;
}
