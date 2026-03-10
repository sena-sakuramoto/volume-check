import {
  deriveEffectiveZoningFromBreakdown,
  pickDefaultParcelIndex,
  toGeoRingFromParcel,
  summarizeDistrictBreakdown,
  type ParcelCandidate,
} from '../address-search-helpers';

describe('address-search-helpers', () => {
  test('containsPoint=true の筆を優先して初期選択インデックスを返す', () => {
    const parcels: ParcelCandidate[] = [
      {
        chiban: '1-1',
        coordinates: [[[139.7, 35.6], [139.71, 35.6], [139.71, 35.61], [139.7, 35.61]]],
        containsPoint: false,
      },
      {
        chiban: '1-2',
        coordinates: [[[139.72, 35.6], [139.73, 35.6], [139.73, 35.61], [139.72, 35.61]]],
        containsPoint: true,
      },
    ];

    expect(pickDefaultParcelIndex(parcels)).toBe(1);
  });

  test('containsPoint=true が無い場合は自動選択しない', () => {
    const parcels: ParcelCandidate[] = [
      {
        chiban: '2-1',
        coordinates: [[[139.7, 35.6], [139.71, 35.6], [139.71, 35.61], [139.7, 35.61]]],
        containsPoint: false,
      },
      {
        chiban: '2-2',
        coordinates: [[[139.72, 35.6], [139.73, 35.6], [139.73, 35.61], [139.72, 35.61]]],
        containsPoint: false,
      },
    ];

    expect(pickDefaultParcelIndex(parcels)).toBe(-1);
  });

  test('筆データから外周リングをlat/lng形式へ変換する', () => {
    const parcel: ParcelCandidate = {
      chiban: '1-3',
      coordinates: [[[139.7, 35.6], [139.71, 35.6], [139.71, 35.61], [139.7, 35.61]]],
      containsPoint: true,
    };

    expect(toGeoRingFromParcel(parcel)).toEqual([
      { lng: 139.7, lat: 35.6 },
      { lng: 139.71, lat: 35.6 },
      { lng: 139.71, lat: 35.61 },
      { lng: 139.7, lat: 35.61 },
    ]);
  });

  test('用途地域の重なり比率をUI表示文字列へ整形する', () => {
    const text = summarizeDistrictBreakdown([
      { district: '商業地域', ratio: 0.62 },
      { district: '近隣商業地域', ratio: 0.38 },
    ]);

    expect(text).toContain('商業地域 62%');
    expect(text).toContain('近隣商業地域 38%');
  });

  test('重なり用途地域から建ぺい率・容積率の加重平均を算出する', () => {
    const derived = deriveEffectiveZoningFromBreakdown([
      { district: '商業地域', ratio: 0.7, coverageRatio: 80, floorAreaRatio: 500, fireDistrict: '防火地域' },
      { district: '近隣商業地域', ratio: 0.3, coverageRatio: 80, floorAreaRatio: 300, fireDistrict: '準防火地域' },
    ]);

    expect(derived).not.toBeNull();
    expect(derived?.coverageRatio).toBeCloseTo(0.8, 4);
    expect(derived?.floorAreaRatio).toBeCloseTo(4.4, 4);
    expect(derived?.fireDistrict).toBe('防火地域');
  });
});
