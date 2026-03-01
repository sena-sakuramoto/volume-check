import type { SiteBoundary, ZoningData, Road } from './types';
import { isResidentialZone } from './zoning';

/**
 * Calculate maximum total floor area (延べ面積) in m².
 * Takes the lesser of:
 *  - Designated FAR (指定容積率)
 *  - Road-based FAR (前面道路幅員 x multiplier)
 * Multiplier is 0.4 for residential zones, 0.6 for others.
 */
export function calculateMaxFloorArea(
  site: SiteBoundary,
  zoning: ZoningData,
  roads: Road[],
): number {
  const designatedFAR = zoning.floorAreaRatio;
  const widestRoad = Math.max(...roads.map((r) => r.width));
  const multiplier = isResidentialZone(zoning.district) ? 0.4 : 0.6;
  const roadBasedFAR = widestRoad * multiplier;
  const effectiveFAR = Math.min(designatedFAR, roadBasedFAR);
  return Math.round(site.area * effectiveFAR * 100) / 100;
}
