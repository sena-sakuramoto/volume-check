import type { SiteBoundary, ZoningData } from './types';

export function calculateMaxCoverage(site: SiteBoundary, zoning: ZoningData): number {
  let ratio = zoning.coverageRatio;
  if (zoning.isCornerLot) ratio += 0.1;
  if (zoning.fireDistrict === '防火地域') ratio += 0.1;
  if (zoning.districtPlan?.coverageRatio !== undefined) {
    ratio = Math.min(ratio, zoning.districtPlan.coverageRatio);
  }
  ratio = Math.min(ratio, 1.0);
  return Math.round(site.area * ratio * 100) / 100;
}
