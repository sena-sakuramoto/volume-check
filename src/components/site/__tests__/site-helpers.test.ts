import { buildRoadFromEdge, matchDistrict } from '../site-helpers';

describe('buildRoadFromEdge', () => {
  const ccwRect = [
    { x: 0, y: 0 },
    { x: 0, y: 15 },
    { x: 10, y: 15 },
    { x: 10, y: 0 },
  ];

  it('selects south-facing boundary edge when direction is south and edge indices are missing', () => {
    const road = buildRoadFromEdge(ccwRect, 6, undefined, 'south');
    expect(road.edgeStart).toEqual({ x: 10, y: 0 });
    expect(road.edgeEnd).toEqual({ x: 0, y: 0 });
    expect(road.bearing).toBe(180);
  });

  it('selects east-facing boundary edge when direction is east and edge indices are missing', () => {
    const road = buildRoadFromEdge(ccwRect, 6, undefined, 'east');
    expect(road.edgeStart).toEqual({ x: 10, y: 15 });
    expect(road.edgeEnd).toEqual({ x: 10, y: 0 });
    expect(road.bearing).toBe(90);
  });
});

describe('matchDistrict', () => {
  it('matches half-width numeric district names', () => {
    expect(matchDistrict('第1種住居地域')).toBe('第一種住居地域');
    expect(matchDistrict('第2種低層住居専用地域')).toBe('第二種低層住居専用地域');
  });

  it('matches common short aliases', () => {
    expect(matchDistrict('近商')).toBe('近隣商業地域');
    expect(matchDistrict('工専')).toBe('工業専用地域');
  });

  it('matches numeric zoning codes', () => {
    expect(matchDistrict('5')).toBe('第一種住居地域');
    expect(matchDistrict('用途地域コード:11')).toBe('準工業地域');
  });
});

