import { calculateHeightDistrictLimit } from '../height-district';
import type { HeightDistrict } from '../types';

describe('calculateHeightDistrictLimit', () => {
  const boundaryStart = { x: 0, y: 10 };
  const boundaryEnd = { x: 10, y: 10 };

  it('returns Infinity for 指定なし', () => {
    const hd: HeightDistrict = { type: '指定なし' };
    const result = calculateHeightDistrictLimit({ x: 5, y: 5 }, boundaryStart, boundaryEnd, hd);
    expect(result).toBe(Infinity);
  });

  it('calculates 第一種 limit at boundary (distance=0)', () => {
    const hd: HeightDistrict = { type: '第一種' };
    const result = calculateHeightDistrictLimit({ x: 5, y: 10 }, boundaryStart, boundaryEnd, hd);
    expect(result).toBeCloseTo(7, 1); // 7m at boundary
  });

  it('calculates 第一種 limit 5m from boundary', () => {
    const hd: HeightDistrict = { type: '第一種' };
    const result = calculateHeightDistrictLimit({ x: 5, y: 5 }, boundaryStart, boundaryEnd, hd);
    // 7 + 5*0.6 = 10
    expect(result).toBeCloseTo(10, 1);
  });

  it('caps 第一種 at absoluteMax 20m', () => {
    const hd: HeightDistrict = { type: '第一種' };
    // At distance 50: 7 + 50*0.6 = 37, but capped at 20
    const result = calculateHeightDistrictLimit({ x: 5, y: -40 }, boundaryStart, boundaryEnd, hd);
    expect(result).toBeCloseTo(20, 1);
  });

  it('calculates 第二種 limit at boundary', () => {
    const hd: HeightDistrict = { type: '第二種' };
    const result = calculateHeightDistrictLimit({ x: 5, y: 10 }, boundaryStart, boundaryEnd, hd);
    expect(result).toBeCloseTo(12, 1);
  });

  it('calculates 第三種 limit 10m from boundary', () => {
    const hd: HeightDistrict = { type: '第三種' };
    const result = calculateHeightDistrictLimit({ x: 5, y: 0 }, boundaryStart, boundaryEnd, hd);
    // 15 + 10*0.6 = 21
    expect(result).toBeCloseTo(21, 1);
  });

  it('respects custom overrides', () => {
    const hd: HeightDistrict = {
      type: '第一種',
      maxHeightAtBoundary: 5,
      slopeRatio: 1.0,
      absoluteMax: 15,
    };
    const result = calculateHeightDistrictLimit({ x: 5, y: 5 }, boundaryStart, boundaryEnd, hd);
    // 5 + 5*1.0 = 10
    expect(result).toBeCloseTo(10, 1);
  });

  it('caps custom at custom absoluteMax', () => {
    const hd: HeightDistrict = {
      type: '第一種',
      maxHeightAtBoundary: 5,
      slopeRatio: 1.0,
      absoluteMax: 8,
    };
    const result = calculateHeightDistrictLimit({ x: 5, y: 0 }, boundaryStart, boundaryEnd, hd);
    // 5 + 10*1.0 = 15, but capped at 8
    expect(result).toBeCloseTo(8, 1);
  });
});
