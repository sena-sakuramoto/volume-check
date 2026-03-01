import { getAbsoluteHeightLimit } from '../absolute-height';

describe('getAbsoluteHeightLimit', () => {
  it('returns 10 when limit is 10', () => {
    expect(getAbsoluteHeightLimit(10)).toBe(10);
  });

  it('returns 12 when limit is 12', () => {
    expect(getAbsoluteHeightLimit(12)).toBe(12);
  });

  it('returns Infinity when limit is null', () => {
    expect(getAbsoluteHeightLimit(null)).toBe(Infinity);
  });

  it('returns the exact numeric value for arbitrary limits', () => {
    expect(getAbsoluteHeightLimit(15)).toBe(15);
    expect(getAbsoluteHeightLimit(20)).toBe(20);
    expect(getAbsoluteHeightLimit(31)).toBe(31);
    expect(getAbsoluteHeightLimit(45)).toBe(45);
  });

  it('returns 0 when limit is 0', () => {
    expect(getAbsoluteHeightLimit(0)).toBe(0);
  });

  it('handles decimal limits', () => {
    expect(getAbsoluteHeightLimit(10.5)).toBe(10.5);
    expect(getAbsoluteHeightLimit(12.3)).toBe(12.3);
  });

  it('returns Infinity which is greater than any finite number', () => {
    const result = getAbsoluteHeightLimit(null);
    expect(result).toBeGreaterThan(1000);
    expect(result).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(Number.isFinite(result)).toBe(false);
  });

  it('returns a finite number when a limit is provided', () => {
    expect(Number.isFinite(getAbsoluteHeightLimit(10))).toBe(true);
    expect(Number.isFinite(getAbsoluteHeightLimit(12))).toBe(true);
  });
});
