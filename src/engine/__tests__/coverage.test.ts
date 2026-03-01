import { calculateMaxCoverage } from '../coverage';
import type { SiteBoundary, ZoningData } from '../types';

const site: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ],
  area: 150,
};

function makeZoning(overrides: Partial<ZoningData> = {}): ZoningData {
  return {
    district: '第一種低層住居専用地域',
    fireDistrict: '指定なし',
    heightDistrict: { type: '指定なし' },
    coverageRatio: 0.6,
    floorAreaRatio: 1.0,
    absoluteHeightLimit: 10,
    wallSetback: 1,
    shadowRegulation: null,
    isCornerLot: false,
    ...overrides,
  };
}

describe('calculateMaxCoverage', () => {
  it('calculates basic coverage with no bonuses', () => {
    const zoning = makeZoning({ coverageRatio: 0.6 });
    // 150 * 0.6 = 90
    expect(calculateMaxCoverage(site, zoning)).toBe(90);
  });

  it('calculates coverage with 50% ratio', () => {
    const zoning = makeZoning({ coverageRatio: 0.5 });
    // 150 * 0.5 = 75
    expect(calculateMaxCoverage(site, zoning)).toBe(75);
  });

  it('calculates coverage with 80% ratio (commercial)', () => {
    const zoning = makeZoning({ coverageRatio: 0.8, district: '商業地域' });
    // 150 * 0.8 = 120
    expect(calculateMaxCoverage(site, zoning)).toBe(120);
  });

  it('applies corner lot bonus (+10%)', () => {
    const zoning = makeZoning({ coverageRatio: 0.6, isCornerLot: true });
    // 150 * (0.6 + 0.1) = 150 * 0.7 = 105
    expect(calculateMaxCoverage(site, zoning)).toBe(105);
  });

  it('applies fire district bonus (+10%)', () => {
    const zoning = makeZoning({ coverageRatio: 0.6, fireDistrict: '防火地域' });
    // 150 * (0.6 + 0.1) = 150 * 0.7 = 105
    expect(calculateMaxCoverage(site, zoning)).toBe(105);
  });

  it('applies both corner lot and fire district bonuses (+20%)', () => {
    const zoning = makeZoning({
      coverageRatio: 0.6,
      isCornerLot: true,
      fireDistrict: '防火地域',
    });
    // 150 * (0.6 + 0.1 + 0.1) = 150 * 0.8 = 120
    expect(calculateMaxCoverage(site, zoning)).toBe(120);
  });

  it('caps effective ratio at 100% (1.0)', () => {
    const zoning = makeZoning({
      coverageRatio: 0.9,
      isCornerLot: true,
      fireDistrict: '防火地域',
    });
    // 0.9 + 0.1 + 0.1 = 1.1 -> capped at 1.0
    // 150 * 1.0 = 150
    expect(calculateMaxCoverage(site, zoning)).toBe(150);
  });

  it('caps at 100% even for 商業地域 with both bonuses', () => {
    const zoning = makeZoning({
      district: '商業地域',
      coverageRatio: 0.8,
      isCornerLot: true,
      fireDistrict: '防火地域',
    });
    // 0.8 + 0.1 + 0.1 = 1.0 -> exactly 100%
    // 150 * 1.0 = 150
    expect(calculateMaxCoverage(site, zoning)).toBe(150);
  });

  it('does not apply bonus for 準防火地域', () => {
    const zoning = makeZoning({
      coverageRatio: 0.6,
      fireDistrict: '準防火地域',
    });
    // 準防火地域 does NOT get the +10% fire bonus
    // 150 * 0.6 = 90
    expect(calculateMaxCoverage(site, zoning)).toBe(90);
  });

  it('works with a small site area', () => {
    const smallSite: SiteBoundary = {
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 5 },
        { x: 0, y: 5 },
      ],
      area: 25,
    };
    const zoning = makeZoning({ coverageRatio: 0.6 });
    // 25 * 0.6 = 15
    expect(calculateMaxCoverage(smallSite, zoning)).toBe(15);
  });

  it('returns proper decimal result for non-round areas', () => {
    const oddSite: SiteBoundary = {
      vertices: [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 11 },
        { x: 0, y: 11 },
      ],
      area: 77,
    };
    const zoning = makeZoning({ coverageRatio: 0.6 });
    // 77 * 0.6 = 46.2
    expect(calculateMaxCoverage(oddSite, zoning)).toBeCloseTo(46.2, 2);
  });

  it('handles coverageRatio of 0.3', () => {
    const zoning = makeZoning({ coverageRatio: 0.3 });
    // 150 * 0.3 = 45
    expect(calculateMaxCoverage(site, zoning)).toBe(45);
  });
});
