import {
  getZoningDefaults,
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
  isResidentialZone,
} from '../zoning';
import type { ZoningDistrict } from '../types';

describe('getZoningDefaults', () => {
  describe('low-rise residential zones', () => {
    it.each<ZoningDistrict>([
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
    ])('%s has absoluteHeightLimit 10, wallSetback 1', (district) => {
      const defaults = getZoningDefaults(district);
      expect(defaults.absoluteHeightLimit).toBe(10);
      expect(defaults.wallSetback).toBe(1);
      expect(defaults.defaultCoverageRatio).toBe(0.5);
      expect(defaults.defaultFloorAreaRatio).toBe(1.0);
      expect(defaults.shadowRegulation).not.toBeNull();
      expect(defaults.shadowRegulation?.measurementHeight).toBe(1.5);
    });
  });

  describe('田園住居地域', () => {
    it('has absoluteHeightLimit 10, wallSetback 1', () => {
      const defaults = getZoningDefaults('田園住居地域');
      expect(defaults.absoluteHeightLimit).toBe(10);
      expect(defaults.wallSetback).toBe(1);
      expect(defaults.defaultCoverageRatio).toBe(0.5);
      expect(defaults.defaultFloorAreaRatio).toBe(1.0);
    });
  });

  describe('mid-rise residential zones', () => {
    it.each<ZoningDistrict>([
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
    ])('%s has no absoluteHeightLimit, no wallSetback', (district) => {
      const defaults = getZoningDefaults(district);
      expect(defaults.absoluteHeightLimit).toBeNull();
      expect(defaults.wallSetback).toBeNull();
      expect(defaults.defaultCoverageRatio).toBe(0.6);
      expect(defaults.defaultFloorAreaRatio).toBe(2.0);
      expect(defaults.shadowRegulation?.measurementHeight).toBe(4);
    });
  });

  describe('general residential zones', () => {
    it.each<ZoningDistrict>([
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
    ])('%s has coverageRatio 0.6, FAR 2.0', (district) => {
      const defaults = getZoningDefaults(district);
      expect(defaults.absoluteHeightLimit).toBeNull();
      expect(defaults.wallSetback).toBeNull();
      expect(defaults.defaultCoverageRatio).toBe(0.6);
      expect(defaults.defaultFloorAreaRatio).toBe(2.0);
      expect(defaults.shadowRegulation?.maxHoursAt5m).toBe(5);
    });
  });

  describe('commercial zones', () => {
    it('近隣商業地域 has coverageRatio 0.8, FAR 3.0', () => {
      const defaults = getZoningDefaults('近隣商業地域');
      expect(defaults.defaultCoverageRatio).toBe(0.8);
      expect(defaults.defaultFloorAreaRatio).toBe(3.0);
      expect(defaults.absoluteHeightLimit).toBeNull();
      expect(defaults.shadowRegulation).not.toBeNull();
    });

    it('商業地域 has coverageRatio 0.8, FAR 4.0, no shadow regulation', () => {
      const defaults = getZoningDefaults('商業地域');
      expect(defaults.defaultCoverageRatio).toBe(0.8);
      expect(defaults.defaultFloorAreaRatio).toBe(4.0);
      expect(defaults.absoluteHeightLimit).toBeNull();
      expect(defaults.shadowRegulation).toBeNull();
    });
  });

  describe('industrial zones', () => {
    it.each<ZoningDistrict>([
      '工業地域',
      '工業専用地域',
    ])('%s has coverageRatio 0.6, FAR 2.0, no shadow regulation', (district) => {
      const defaults = getZoningDefaults(district);
      expect(defaults.defaultCoverageRatio).toBe(0.6);
      expect(defaults.defaultFloorAreaRatio).toBe(2.0);
      expect(defaults.absoluteHeightLimit).toBeNull();
      expect(defaults.wallSetback).toBeNull();
      expect(defaults.shadowRegulation).toBeNull();
    });

    it('準工業地域 has shadow regulation', () => {
      const defaults = getZoningDefaults('準工業地域');
      expect(defaults.defaultCoverageRatio).toBe(0.6);
      expect(defaults.shadowRegulation).not.toBeNull();
    });
  });
});

describe('getRoadSetbackParams', () => {
  it('returns slopeRatio 1.25 and applicationDistance 20 for residential zones', () => {
    const params = getRoadSetbackParams('第一種低層住居専用地域');
    expect(params.slopeRatio).toBe(1.25);
    expect(params.applicationDistance).toBe(20);
    expect(params.setbackDistance).toBe(0);
  });

  it('returns slopeRatio 1.25 for all residential zones', () => {
    const residentialDistricts: ZoningDistrict[] = [
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
      '田園住居地域',
    ];
    for (const district of residentialDistricts) {
      const params = getRoadSetbackParams(district);
      expect(params.slopeRatio).toBe(1.25);
      expect(params.applicationDistance).toBe(20);
    }
  });

  it('returns slopeRatio 1.5 and applicationDistance 25 for commercial zones', () => {
    const params = getRoadSetbackParams('商業地域');
    expect(params.slopeRatio).toBe(1.5);
    expect(params.applicationDistance).toBe(25);
  });

  it('returns slopeRatio 1.5 for industrial zones', () => {
    const params = getRoadSetbackParams('工業地域');
    expect(params.slopeRatio).toBe(1.5);
    expect(params.applicationDistance).toBe(25);
  });

  it('returns slopeRatio 1.5 for 近隣商業地域', () => {
    const params = getRoadSetbackParams('近隣商業地域');
    expect(params.slopeRatio).toBe(1.5);
    expect(params.applicationDistance).toBe(25);
  });
});

describe('getAdjacentSetbackParams', () => {
  it('returns riseHeight 20 and slopeRatio 1.25 for residential zones', () => {
    const params = getAdjacentSetbackParams('第一種低層住居専用地域');
    expect(params.riseHeight).toBe(20);
    expect(params.slopeRatio).toBe(1.25);
  });

  it('returns riseHeight 31 and slopeRatio 2.5 for commercial zones', () => {
    const params = getAdjacentSetbackParams('商業地域');
    expect(params.riseHeight).toBe(31);
    expect(params.slopeRatio).toBe(2.5);
  });

  it('returns riseHeight 31 and slopeRatio 2.5 for industrial zones', () => {
    const params = getAdjacentSetbackParams('工業地域');
    expect(params.riseHeight).toBe(31);
    expect(params.slopeRatio).toBe(2.5);
  });

  it('returns residential params for 準住居地域', () => {
    const params = getAdjacentSetbackParams('準住居地域');
    expect(params.riseHeight).toBe(20);
    expect(params.slopeRatio).toBe(1.25);
  });
});

describe('getNorthSetbackParams', () => {
  it('returns riseHeight 5 and slopeRatio 1.25 for low-rise residential', () => {
    const params = getNorthSetbackParams('第一種低層住居専用地域');
    expect(params).not.toBeNull();
    expect(params!.riseHeight).toBe(5);
    expect(params!.slopeRatio).toBe(1.25);
  });

  it('returns riseHeight 5 for 第二種低層住居専用地域', () => {
    const params = getNorthSetbackParams('第二種低層住居専用地域');
    expect(params).not.toBeNull();
    expect(params!.riseHeight).toBe(5);
  });

  it('returns riseHeight 5 for 田園住居地域', () => {
    const params = getNorthSetbackParams('田園住居地域');
    expect(params).not.toBeNull();
    expect(params!.riseHeight).toBe(5);
  });

  it('returns riseHeight 10 for mid-rise residential', () => {
    const params = getNorthSetbackParams('第一種中高層住居専用地域');
    expect(params).not.toBeNull();
    expect(params!.riseHeight).toBe(10);
    expect(params!.slopeRatio).toBe(1.25);
  });

  it('returns riseHeight 10 for 第二種中高層住居専用地域', () => {
    const params = getNorthSetbackParams('第二種中高層住居専用地域');
    expect(params).not.toBeNull();
    expect(params!.riseHeight).toBe(10);
  });

  it('returns null for general residential zones (第一種住居地域)', () => {
    expect(getNorthSetbackParams('第一種住居地域')).toBeNull();
  });

  it('returns null for commercial zones', () => {
    expect(getNorthSetbackParams('商業地域')).toBeNull();
    expect(getNorthSetbackParams('近隣商業地域')).toBeNull();
  });

  it('returns null for industrial zones', () => {
    expect(getNorthSetbackParams('工業地域')).toBeNull();
    expect(getNorthSetbackParams('工業専用地域')).toBeNull();
    expect(getNorthSetbackParams('準工業地域')).toBeNull();
  });
});

describe('isResidentialZone', () => {
  it('returns true for all 8 residential zone types', () => {
    const residentialDistricts: ZoningDistrict[] = [
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
      '田園住居地域',
    ];
    for (const district of residentialDistricts) {
      expect(isResidentialZone(district)).toBe(true);
    }
  });

  it('returns false for commercial zones', () => {
    expect(isResidentialZone('商業地域')).toBe(false);
    expect(isResidentialZone('近隣商業地域')).toBe(false);
  });

  it('returns false for industrial zones', () => {
    expect(isResidentialZone('工業地域')).toBe(false);
    expect(isResidentialZone('工業専用地域')).toBe(false);
    expect(isResidentialZone('準工業地域')).toBe(false);
  });
});
