import {
  normalizeDetectedAddress,
  mergeZoningWithSupplement,
  summarizeSupplementResult,
} from '../file-upload-helpers';

describe('file-upload-helpers', () => {
  test('住所文字列を正規化して空文字を除外する', () => {
    expect(normalizeDetectedAddress('  〒153-0064 東京都目黒区下目黒2-19-1  ')).toBe(
      '〒153-0064 東京都目黒区下目黒2-19-1',
    );
    expect(normalizeDetectedAddress('   ')).toBeNull();
    expect(normalizeDetectedAddress(null)).toBeNull();
  });

  test('AIの用途地域結果に住所補完結果をマージする（欠損のみ補完）', () => {
    const merged = mergeZoningWithSupplement(
      {
        district: '商業地域',
        coverageRatio: null,
        floorAreaRatio: 5,
        fireDistrict: null,
      },
      {
        district: '近隣商業地域',
        coverageRatio: 0.8,
        floorAreaRatio: 3,
        fireDistrict: '準防火地域',
      },
    );

    expect(merged).toEqual({
      district: '商業地域',
      coverageRatio: 0.8,
      floorAreaRatio: 5,
      fireDistrict: '準防火地域',
    });
  });

  test('補完結果サマリを表示文言に変換する', () => {
    const summary = summarizeSupplementResult({
      usedAddress: '東京都目黒区下目黒2-19-1',
      geocoded: true,
      zoningSupplemented: true,
    });

    expect(summary).toContain('住所補完');
    expect(summary).toContain('用途地域補完');
  });
});

