import { latLngToTile, pointInPolygon, lngLatToMeters } from '../mvt-utils';

describe('latLngToTile', () => {
  test('東京駅をz14でタイル計算', () => {
    const { tileX, tileY } = latLngToTile(35.6812, 139.7671, 14);
    expect(tileX).toBe(14552);
    expect(tileY).toBe(6451);
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  test('内部の点', () => {
    expect(pointInPolygon(50, 50, square)).toBe(true);
  });

  test('外部の点', () => {
    expect(pointInPolygon(150, 50, square)).toBe(false);
  });
});

describe('lngLatToMeters', () => {
  test('同一点は原点', () => {
    const result = lngLatToMeters([[139.7671, 35.6812]], 35.6812, 139.7671);
    expect(result[0].x).toBeCloseTo(0, 0);
    expect(result[0].y).toBeCloseTo(0, 0);
  });
});
