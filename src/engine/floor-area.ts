import type { SiteBoundary, ZoningData, Road } from './types';
import { isResidentialZone } from './zoning';
import { getRoadFloorAreaReferenceWidth } from './setback-road';

export function calculateMaxFloorArea(
  site: SiteBoundary,
  zoning: ZoningData,
  roads: Road[],
): number {
  const designatedFAR = Math.min(
    zoning.floorAreaRatio,
    zoning.districtPlan?.floorAreaRatio ?? Infinity,
  );
  const widestRoad = roads.length > 0
    ? Math.max(...roads.map((road) => getRoadFloorAreaReferenceWidth(road)))
    : 0;
  const multiplier = isResidentialZone(zoning.district) ? 0.4 : 0.6;
  const roadBasedFAR = widestRoad * multiplier;
  const effectiveFAR = Math.min(designatedFAR, roadBasedFAR);
  return Math.round(site.area * effectiveFAR * 100) / 100;
}
