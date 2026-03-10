import type { Point2D, Road } from './types';
import { distanceToSegment } from './geometry';

export interface RoadSetbackHeightOptions {
  effectiveRoadWidth?: number;
  requiredFrontSetback?: number;
  heightOffset?: number;
  setbackRelief?: number;
}

function getRoadCenterlineDistance(point: Point2D, road: Road): number {
  return distanceToSegment(point, road.edgeStart, road.edgeEnd) + road.width / 2;
}

/**
 * 42条2項道路などで必要になる最小後退距離。
 * 現状は 4m みなし道路を前提に扱う。
 */
export function getNarrowRoadSetbackDistance(width: number): number {
  return width < 4 ? (4 - width) / 2 : 0;
}

/**
 * Road-slope only effective width.
 * Includes confirmed opposite-side relief and optional manual override.
 */
export function getRoadSlopeEffectiveWidth(road: Road): number {
  const deemedWidth = Math.max(road.width, 4);
  const overrideWidth = Math.max(road.slopeWidthOverride ?? 0, deemedWidth);
  return overrideWidth + (road.oppositeSideSetback ?? 0) + (road.oppositeOpenSpace ?? 0);
}

/**
 * Additional horizontal distance credited under BSA Article 56(2)
 * when the building face is set back from the front-road boundary.
 *
 * This is separate from the no-build frontage line itself. The building
 * setback counts once in the point's actual distance from the road edge,
 * and a second time by moving the deemed opposite-side reference outward.
 */
export function getRoadSlopeSetbackRelief(road: Road, roadFacingWallSetback = 0): number {
  return Math.max(0, road.frontSetback ?? 0) + Math.max(0, roadFacingWallSetback);
}

/**
 * Horizontal offset from the original site boundary to the legal road-slope
 * reference line on the opposite side of the road/open space.
 */
export function getRoadSlopeReferenceOffset(
  road: Road,
  effectiveRoadWidth = getRoadSlopeEffectiveWidth(road),
  setbackRelief = getRoadSlopeSetbackRelief(road),
): number {
  return effectiveRoadWidth - getNarrowRoadSetbackDistance(road.width) + setbackRelief;
}

/**
 * Width used for FAR road-width limitation.
 * Opposite-side relief and road-slope-only overrides do not apply here.
 */
export function getRoadFloorAreaReferenceWidth(road: Road): number {
  return road.width;
}

/**
 * Minimum no-build frontage distance for this road.
 * Includes both 2項道路後退 and any project-side frontage retreat.
 */
export function getRoadRequiredFrontSetback(road: Road): number {
  return getNarrowRoadSetbackDistance(road.width) + Math.max(0, road.frontSetback ?? 0);
}

/**
 * Base height offset for road-slope calculation.
 * Positive siteHeightAboveRoad makes the allowed height tighter.
 */
export function getRoadSlopeHeightOffset(road: Road): number {
  return -(road.siteHeightAboveRoad ?? 0);
}

/**
 * Height available exactly at the buildable frontage line of this road.
 */
export function getRoadSlopeStartHeight(
  road: Road,
  slopeRatio: number,
  setbackRelief = getRoadSlopeSetbackRelief(road),
): number {
  const requiredFrontSetback = getRoadRequiredFrontSetback(road);
  const referenceOffset = getRoadSlopeReferenceOffset(road, undefined, setbackRelief);
  return Math.max(
    0,
    (requiredFrontSetback + referenceOffset) * slopeRatio + getRoadSlopeHeightOffset(road),
  );
}

/**
 * Resolve the effective width of each road at a point.
 *
 * When multiple roads are active around a corner, the wider confirmed
 * reference width can be used as a support calculation for the overlap zone.
 * This is intentionally conservative to confirmed road-edge candidates only
 * and limited to points within the application band of those roads.
 */
export function getRoadSlopeEffectiveWidthsAtPoint(
  point: Point2D,
  roads: Road[],
  applicationDistance?: number,
): number[] {
  const baseWidths = roads.map((road) => getRoadSlopeEffectiveWidth(road));
  if (roads.length < 2) return baseWidths;

  const resolvedWidths = [...baseWidths];

  for (let dominantIndex = 0; dominantIndex < roads.length; dominantIndex++) {
    const dominantRoad = roads[dominantIndex];
    if (dominantRoad.enableTwoA35m !== true) continue;

    const dominantWidth = baseWidths[dominantIndex];
    const dominantBoundaryDistance = distanceToSegment(
      point,
      dominantRoad.edgeStart,
      dominantRoad.edgeEnd,
    );

    if (
      applicationDistance !== undefined &&
      dominantBoundaryDistance > applicationDistance + 1e-9
    ) {
      continue;
    }

    const reliefDistance = Math.min(dominantWidth * 2, 35);
    if (dominantBoundaryDistance > reliefDistance + 1e-9) continue;

    for (let targetIndex = 0; targetIndex < roads.length; targetIndex++) {
      if (targetIndex === dominantIndex) continue;
      if (dominantWidth <= resolvedWidths[targetIndex] + 1e-9) continue;

      const targetCenterlineDistance = getRoadCenterlineDistance(point, roads[targetIndex]);
      if (targetCenterlineDistance <= 10 + 1e-9) continue;

      resolvedWidths[targetIndex] = dominantWidth;
    }
  }

  return resolvedWidths;
}

/**
 * Calculate max allowed height at a point due to a single road's
 * setback regulation (道路斜線制限).
 *
 * height = heightOffset + (distance from opposite side of effective road) * slopeRatio
 */
export function calculateRoadSetbackHeight(
  point: Point2D,
  road: Road,
  slopeRatio: number,
  applicationDistance?: number,
  options?: RoadSetbackHeightOptions,
): number {
  const distFromBoundary = distanceToSegment(point, road.edgeStart, road.edgeEnd);
  if (applicationDistance !== undefined && distFromBoundary > applicationDistance) {
    return Infinity;
  }

  const requiredFrontSetback =
    options?.requiredFrontSetback ?? getRoadRequiredFrontSetback(road);
  const effectiveRoadWidth =
    options?.effectiveRoadWidth ?? getRoadSlopeEffectiveWidth(road);
  const heightOffset = options?.heightOffset ?? getRoadSlopeHeightOffset(road);
  const setbackRelief = options?.setbackRelief ?? getRoadSlopeSetbackRelief(road);
  const referenceOffset = getRoadSlopeReferenceOffset(road, effectiveRoadWidth, setbackRelief);

  if (requiredFrontSetback > 0 && distFromBoundary < requiredFrontSetback) {
    return 0;
  }

  const distFromOpposite = distFromBoundary + referenceOffset;
  return Math.max(0, heightOffset + distFromOpposite * slopeRatio);
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
  const effectiveWidths = getRoadSlopeEffectiveWidthsAtPoint(point, roads, applicationDistance);
  return Math.min(
    ...roads.map((road, index) =>
      calculateRoadSetbackHeight(
        point,
        road,
        slopeRatio,
        applicationDistance,
        { effectiveRoadWidth: effectiveWidths[index] },
      ),
    ),
  );
}
