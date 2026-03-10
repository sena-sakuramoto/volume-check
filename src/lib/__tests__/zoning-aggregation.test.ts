import {
  aggregateDistrictsFromSampling,
  pickDominantDistrict,
  type TilePoint,
} from '../zoning-aggregation';

describe('zoning-aggregation', () => {
  const square: TilePoint[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ];

  test('敷地ポリゴンをサンプリングして用途地域の比率を返す', () => {
    const districts = aggregateDistrictsFromSampling(
      square,
      (x) => {
        if (x < 10) {
          return {
            district: '商業地域',
            coverageRatio: 80,
            floorAreaRatio: 500,
            fireDistrict: '防火地域',
          };
        }
        return {
          district: '近隣商業地域',
          coverageRatio: 80,
          floorAreaRatio: 300,
          fireDistrict: '準防火地域',
        };
      },
      { step: 1 },
    );

    expect(districts).toHaveLength(2);
    const byName = new Map(districts.map((item) => [item.district, item]));
    expect(byName.has('商業地域')).toBe(true);
    expect(byName.has('近隣商業地域')).toBe(true);
    expect(byName.get('商業地域')?.ratio).toBeGreaterThan(0.45);
    expect(byName.get('商業地域')?.ratio).toBeLessThan(0.55);
    expect(byName.get('近隣商業地域')?.ratio).toBeGreaterThan(0.45);
    expect(byName.get('近隣商業地域')?.ratio).toBeLessThan(0.55);
  });

  test('有効サンプルがない場合は空配列を返す', () => {
    const districts = aggregateDistrictsFromSampling(square, () => null, { step: 2 });
    expect(districts).toEqual([]);
  });

  test('比率最大の用途地域を主用途として返す', () => {
    const dominant = pickDominantDistrict([
      {
        district: '近隣商業地域',
        ratio: 0.35,
        coverageRatio: 80,
        floorAreaRatio: 300,
        fireDistrict: '準防火地域',
      },
      {
        district: '商業地域',
        ratio: 0.65,
        coverageRatio: 80,
        floorAreaRatio: 500,
        fireDistrict: '防火地域',
      },
    ]);

    expect(dominant?.district).toBe('商業地域');
    expect(dominant?.ratio).toBe(0.65);
  });
});
