import type { SiteBoundary, ZoningData } from './types';

/**
 * Calculate maximum building coverage area (建築面積) in m².
 * Applies corner lot bonus (+10%) and fire district bonus (+10%).
 * Caps the effective ratio at 1.0 (100%).
 */
export function calculateMaxCoverage(
  site: SiteBoundary,
  zoning: ZoningData,
  buildableArea: number,
): number {
  let ratio = zoning.coverageRatio;
  if (zoning.isCornerLot) ratio += 0.1;
  if (zoning.fireDistrict === '防火地域') ratio += 0.1;
  ratio = Math.min(ratio, 1.0);
  const farBasedLimit = site.area * ratio;
  const effective = Math.min(farBasedLimit, buildableArea);
  return Math.round(effective * 100) / 100;
}
