import { generateEnvelope } from '../envelope';
import {
  evaluateShadowCompliance,
  findMaxHeightForPattern,
  generateBuildingPatterns,
} from '../building-pattern';
import { applyWallSetback } from '../wall-setback';
import { polygonArea } from '../geometry';
import { DEMO_INPUT, DEMO_SITE, DEMO_ZONING, DEMO_ROADS } from '@/lib/demo-data';
import type {
  Point2D,
  SiteBoundary,
  ZoningData,
  Road,
  VolumeInput,
  VolumeResult,
  ShadowRegulation,
  BuildingPatternResult,
  PatternResult,
} from '../types';

// ---------------------------------------------------------------------------
// A) Integration test with demo data via generateEnvelope
// ---------------------------------------------------------------------------

describe('buildingPatterns via generateEnvelope with demo data', () => {
  let result: VolumeResult;

  beforeAll(() => {
    result = generateEnvelope(DEMO_INPUT);
  });

  // b) buildingPatterns should not be null when shadow regulation exists
  it('buildingPatterns is not null when shadow regulation exists', () => {
    expect(DEMO_ZONING.shadowRegulation).not.toBeNull();
    expect(result.buildingPatterns).not.toBeNull();
  });

  // c) Low-rise pattern sanity checks
  describe('low-rise pattern', () => {
    let lowRise: PatternResult;

    beforeAll(() => {
      lowRise = result.buildingPatterns!.lowRise;
    });

    it('footprint should match the buildable polygon (wall setback applied)', () => {
      const expectedBuildable = applyWallSetback(
        DEMO_SITE.vertices,
        DEMO_ZONING.wallSetback,
      );
      expect(lowRise.footprint).toEqual(expectedBuildable);
    });

    it('maxHeight should be positive', () => {
      expect(lowRise.maxHeight).toBeGreaterThan(0);
    });

    it('maxHeight should be reasonable (< 100m)', () => {
      expect(lowRise.maxHeight).toBeLessThan(100);
    });

    it('maxHeight should not exceed the absolute height limit', () => {
      // Demo has absoluteHeightLimit = 10
      expect(lowRise.maxHeight).toBeLessThanOrEqual(DEMO_ZONING.absoluteHeightLimit!);
    });

    it('maxFloors should be consistent with maxHeight / 3.0', () => {
      const expectedFloors = Math.floor(lowRise.maxHeight / 3.0);
      expect(lowRise.maxFloors).toBe(expectedFloors);
    });

    it('maxFloors should be a non-negative integer', () => {
      expect(Number.isInteger(lowRise.maxFloors)).toBe(true);
      expect(lowRise.maxFloors).toBeGreaterThanOrEqual(0);
    });

    it('footprintArea should be positive', () => {
      expect(lowRise.footprintArea).toBeGreaterThan(0);
    });

    it('footprintArea should match polygonArea of the footprint', () => {
      const computedArea = polygonArea(lowRise.footprint);
      expect(lowRise.footprintArea).toBeCloseTo(computedArea, 1);
    });

    it('totalFloorArea should approximately equal footprintArea * maxFloors', () => {
      const expected = lowRise.footprintArea * lowRise.maxFloors;
      expect(lowRise.totalFloorArea).toBeCloseTo(expected, 1);
    });

    it('compliance worstHoursAt5m <= regulation limit when passes=true', () => {
      if (lowRise.compliance.passes) {
        expect(lowRise.compliance.worstHoursAt5m).toBeLessThanOrEqual(
          DEMO_ZONING.shadowRegulation!.maxHoursAt5m,
        );
        expect(lowRise.compliance.worstHoursAt10m).toBeLessThanOrEqual(
          DEMO_ZONING.shadowRegulation!.maxHoursAt10m,
        );
      }
    });

    it('compliance object has expected shape', () => {
      expect(lowRise.compliance).toHaveProperty('passes');
      expect(lowRise.compliance).toHaveProperty('worstHoursAt5m');
      expect(lowRise.compliance).toHaveProperty('worstHoursAt10m');
      expect(typeof lowRise.compliance.passes).toBe('boolean');
      expect(typeof lowRise.compliance.worstHoursAt5m).toBe('number');
      expect(typeof lowRise.compliance.worstHoursAt10m).toBe('number');
    });
  });

  // d) Mid-high-rise pattern sanity checks
  describe('mid-high-rise pattern', () => {
    let midHighRise: PatternResult;
    let lowRise: PatternResult;

    beforeAll(() => {
      midHighRise = result.buildingPatterns!.midHighRise;
      lowRise = result.buildingPatterns!.lowRise;
    });

    it('footprint should be smaller than low-rise footprint (5m additional inset)', () => {
      const midHighArea = polygonArea(midHighRise.footprint);
      const lowRiseArea = polygonArea(lowRise.footprint);
      // The mid-high-rise footprint is an additional 5m inset, so should be smaller
      // For small sites, the footprint might collapse to 0
      expect(midHighArea).toBeLessThan(lowRiseArea);
    });

    it('maxHeight should be >= low-rise maxHeight (smaller footprint -> less shadow -> can go taller)', () => {
      // Smaller footprint casts less shadow, so should be able to go taller (or equal)
      // However, it's capped by absLimit and envelope, so equal is also valid
      if (midHighRise.footprintArea > 0) {
        expect(midHighRise.maxHeight).toBeGreaterThanOrEqual(lowRise.maxHeight);
      } else {
        expect(midHighRise.maxHeight).toBe(0);
      }
    });

    it('maxHeight should be positive', () => {
      // For the demo site (10x15), a 5m inset on the buildable polygon may leave
      // a very small area, but let's check if the result is sensible
      if (midHighRise.footprintArea > 0) {
        expect(midHighRise.maxHeight).toBeGreaterThan(0);
      }
    });

    it('maxHeight should be reasonable (< 100m)', () => {
      expect(midHighRise.maxHeight).toBeLessThan(100);
    });

    it('maxFloors should be consistent with maxHeight / 3.0', () => {
      const expectedFloors = Math.floor(midHighRise.maxHeight / 3.0);
      expect(midHighRise.maxFloors).toBe(expectedFloors);
    });

    it('footprintArea should be non-negative', () => {
      expect(midHighRise.footprintArea).toBeGreaterThanOrEqual(0);
    });

    it('when footprint collapses, compliance should fail', () => {
      if (midHighRise.footprintArea === 0) {
        expect(midHighRise.compliance.passes).toBe(false);
      }
    });

    it('totalFloorArea should approximately equal footprintArea * maxFloors', () => {
      const expected = midHighRise.footprintArea * midHighRise.maxFloors;
      expect(midHighRise.totalFloorArea).toBeCloseTo(expected, 1);
    });

    it('compliance worstHoursAt5m <= regulation limit when passes=true', () => {
      if (midHighRise.compliance.passes) {
        expect(midHighRise.compliance.worstHoursAt5m).toBeLessThanOrEqual(
          DEMO_ZONING.shadowRegulation!.maxHoursAt5m,
        );
        expect(midHighRise.compliance.worstHoursAt10m).toBeLessThanOrEqual(
          DEMO_ZONING.shadowRegulation!.maxHoursAt10m,
        );
      }
    });

    it('pattern name is correct', () => {
      expect(midHighRise.name).toBe('中高層パターン');
    });
  });

  // Check structural properties of BuildingPatternResult
  describe('BuildingPatternResult structure', () => {
    it('has lowRise, midHighRise, and optimal properties', () => {
      expect(result.buildingPatterns).toHaveProperty('lowRise');
      expect(result.buildingPatterns).toHaveProperty('midHighRise');
      expect(result.buildingPatterns).toHaveProperty('optimal');
    });

    it('pattern names are correct', () => {
      expect(result.buildingPatterns!.lowRise.name).toBe('低層パターン');
      expect(result.buildingPatterns!.midHighRise.name).toBe('中高層パターン');
      expect(result.buildingPatterns!.optimal.name).toBe('最適パターン');
    });

    it('optimal totalFloorArea is >= max(lowRise, midHighRise)', () => {
      const { lowRise, midHighRise, optimal } = result.buildingPatterns!;
      const best = Math.max(lowRise.totalFloorArea, midHighRise.totalFloorArea);
      expect(optimal.totalFloorArea).toBeGreaterThanOrEqual(best);
    });
  });
});

// ---------------------------------------------------------------------------
// When there is no shadow regulation, buildingPatterns should be null
// ---------------------------------------------------------------------------

describe('buildingPatterns is null when no shadow regulation', () => {
  it('returns null buildingPatterns for commercial zone without shadow regulation', () => {
    const zoningNoShadow: ZoningData = {
      district: '商業地域',
      fireDistrict: '防火地域',
      heightDistrict: { type: '指定なし' },
      coverageRatio: 0.8,
      floorAreaRatio: 4.0,
      absoluteHeightLimit: null,
      wallSetback: null,
      shadowRegulation: null,
      isCornerLot: false,
    };
    const input: VolumeInput = {
      site: DEMO_SITE,
      zoning: zoningNoShadow,
      roads: DEMO_ROADS,
      latitude: 35.68,
    };
    const result = generateEnvelope(input);
    expect(result.buildingPatterns).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// e) Minimal rectangular site test with direct evaluateShadowCompliance call
// ---------------------------------------------------------------------------

describe('evaluateShadowCompliance with a minimal rectangular site', () => {
  // Create a 20m x 20m rectangular site
  const rectSite: Point2D[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ];

  // Shadow regulation: measurement 4m, maxHoursAt5m=4, maxHoursAt10m=2.5
  const shadowReg: ShadowRegulation = {
    measurementHeight: 4,
    maxHoursAt5m: 4,
    maxHoursAt10m: 2.5,
  };

  // Tokyo latitude
  const latitude = 35.68;

  // North rotation = 0 (standard orientation: +Y = north)
  const northRotation = 0;

  it('a very low building should pass shadow compliance', () => {
    // A 3m-tall building on the full site should cast minimal shadow
    const footprint = rectSite;
    const height = 3.0; // 3m = 1 floor, shorter than measurement height of 4m

    const result = evaluateShadowCompliance(
      footprint,
      height,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
    );

    // A 3m building below 4m measurement height should cast no shadow at that plane
    expect(result.passes).toBe(true);
    expect(result.worstHoursAt5m).toBe(0);
    expect(result.worstHoursAt10m).toBe(0);
  });

  it('a very tall building should fail or produce significant shadow hours', () => {
    // A 50m-tall building on the full 20x20 site will cast long shadows
    const footprint = rectSite;
    const height = 50.0;

    const result = evaluateShadowCompliance(
      footprint,
      height,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
    );

    // At 50m, shadow hours should be significant
    expect(result.worstHoursAt5m).toBeGreaterThan(0);
    // Likely exceeds the 4-hour limit
    expect(result.passes).toBe(false);
  });

  it('shadow hours at 10m should be <= shadow hours at 5m', () => {
    // Shadows extend further but are thinner at greater distances
    // Points at 10m from boundary are further out, so worst case hours should be <=
    const footprint = rectSite;
    const height = 20.0;

    const result = evaluateShadowCompliance(
      footprint,
      height,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
    );

    expect(result.worstHoursAt10m).toBeLessThanOrEqual(result.worstHoursAt5m);
  });

  it('taller building should produce equal or more shadow hours than shorter building', () => {
    const footprint = rectSite;

    const resultShort = evaluateShadowCompliance(
      footprint,
      10.0,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
    );

    const resultTall = evaluateShadowCompliance(
      footprint,
      30.0,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
    );

    expect(resultTall.worstHoursAt5m).toBeGreaterThanOrEqual(resultShort.worstHoursAt5m);
    expect(resultTall.worstHoursAt10m).toBeGreaterThanOrEqual(resultShort.worstHoursAt10m);
  });
});

// ---------------------------------------------------------------------------
// findMaxHeightForPattern with the minimal rectangular site
// ---------------------------------------------------------------------------

describe('findMaxHeightForPattern with rectangular site', () => {
  const rectSite: Point2D[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ];

  const shadowReg: ShadowRegulation = {
    measurementHeight: 4,
    maxHoursAt5m: 4,
    maxHoursAt10m: 2.5,
  };

  const latitude = 35.68;
  const northRotation = 0;

  it('finds a maxHeight that passes shadow compliance', () => {
    // Use the full site as the footprint with a 100m height cap
    const footprint = rectSite;
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    expect(result.maxHeight).toBeGreaterThan(0);
    expect(result.compliance.passes).toBe(true);
    expect(result.compliance.worstHoursAt5m).toBeLessThanOrEqual(shadowReg.maxHoursAt5m);
    expect(result.compliance.worstHoursAt10m).toBeLessThanOrEqual(shadowReg.maxHoursAt10m);
  });

  it('maxFloors is consistent with maxHeight', () => {
    const footprint = rectSite;
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    expect(result.maxFloors).toBe(Math.floor(result.maxHeight / 3.0));
  });

  it('footprintArea matches polygonArea of the footprint', () => {
    const footprint = rectSite;
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    const expected = polygonArea(footprint); // 400 m^2
    expect(result.footprintArea).toBeCloseTo(expected, 1);
  });

  it('totalFloorArea = footprintArea * maxFloors', () => {
    const footprint = rectSite;
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    const expected = result.footprintArea * result.maxFloors;
    expect(result.totalFloorArea).toBeCloseTo(expected, 1);
  });

  it('respects height cap', () => {
    const footprint = rectSite;
    const heightCap = 15;
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      heightCap,
    );

    expect(result.maxHeight).toBeLessThanOrEqual(heightCap);
  });

  it('handles height cap below measurement height', () => {
    const footprint = rectSite;
    const heightCap = 2; // below measurementHeight (4m)
    const result = findMaxHeightForPattern(
      footprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      heightCap,
    );

    expect(result.maxHeight).toBeLessThanOrEqual(heightCap);
    expect(result.compliance.passes).toBe(true);
  });

  it('smaller footprint allows taller building (less shadow)', () => {
    // Full site
    const resultFull = findMaxHeightForPattern(
      rectSite,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    // Inset footprint (smaller)
    const insetFootprint = applyWallSetback(rectSite, 5);
    const resultInset = findMaxHeightForPattern(
      insetFootprint,
      rectSite,
      shadowReg,
      latitude,
      northRotation,
      100,
    );

    // Smaller footprint should allow equal or taller maxHeight
    expect(resultInset.maxHeight).toBeGreaterThanOrEqual(resultFull.maxHeight);
  });
});
