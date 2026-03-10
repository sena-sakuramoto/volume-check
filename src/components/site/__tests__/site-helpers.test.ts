import { buildRoadFromEdge, buildRoadsFromPolygonConfigs, matchDistrict } from '../site-helpers';

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

  it('uses explicit edge indices even when direction is set', () => {
    const road = buildRoadFromEdge(ccwRect, 6, [1, 2], 'south');
    expect(road.edgeStart).toEqual({ x: 0, y: 15 });
    expect(road.edgeEnd).toEqual({ x: 10, y: 15 });
    // explicit edge should use geometric inward direction derived from edge orientation
    expect(road.bearing).toBe(180);
  });

  it('builds polygon roads from configs with explicit edge selection', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 12, y: 6 },
      { x: 4, y: 10 },
      { x: -2, y: 5 },
    ];
    const roads = buildRoadsFromPolygonConfigs(polygon, [
      { id: 'r1', width: 6, direction: 'south', customWidth: '', edgeVertexIndices: [2, 3] },
    ]);
    expect(roads).toHaveLength(1);
    expect(roads[0].edgeStart).toEqual({ x: 12, y: 6 });
    expect(roads[0].edgeEnd).toEqual({ x: 4, y: 10 });
    expect(roads[0].bearing).toBeGreaterThanOrEqual(0);
    expect(roads[0].bearing).toBeLessThan(360);
  });

  it('preserves advanced road-slope settings from road configs', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 8 },
      { x: 0, y: 8 },
    ];
    const [road] = buildRoadsFromPolygonConfigs(polygon, [
      {
        id: 'r1',
        width: 4,
        direction: 'south',
        customWidth: '',
        frontSetback: 1.2,
        oppositeSideSetback: 0.8,
        oppositeOpenSpace: 2.5,
        oppositeOpenSpaceKind: 'park',
        slopeWidthOverride: 8,
        siteHeightAboveRoad: 1.1,
        enableTwoA35m: true,
      },
    ]);

    expect(road.frontSetback).toBe(1.2);
    expect(road.oppositeSideSetback).toBe(0.8);
    expect(road.oppositeOpenSpace).toBe(2.5);
    expect(road.oppositeOpenSpaceKind).toBe('park');
    expect(road.slopeWidthOverride).toBe(8);
    expect(road.siteHeightAboveRoad).toBe(1.1);
    expect(road.enableTwoA35m).toBe(true);
  });

  it('avoids assigning duplicate boundary edges for multiple polygon roads', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ];
    const roads = buildRoadsFromPolygonConfigs(polygon, [
      { id: 'r1', width: 6, direction: 'south', customWidth: '', edgeVertexIndices: [0, 1] },
      { id: 'r2', width: 4, direction: 'south', customWidth: '', edgeVertexIndices: [0, 1] },
    ]);

    expect(roads).toHaveLength(2);
    const keys = roads.map((r) => `${r.edgeStart.x},${r.edgeStart.y}|${r.edgeEnd.x},${r.edgeEnd.y}`);
    expect(new Set(keys).size).toBe(2);
  });

  it('avoids duplicate edges even when all polygon roads use auto edge selection', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 16, y: 0 },
      { x: 16, y: 10 },
      { x: 0, y: 10 },
    ];
    const roads = buildRoadsFromPolygonConfigs(polygon, [
      { id: 'r1', width: 6, direction: 'south', customWidth: '' },
      { id: 'r2', width: 4, direction: 'south', customWidth: '' },
      { id: 'r3', width: 8, direction: 'south', customWidth: '' },
    ]);

    expect(roads).toHaveLength(3);
    const keys = roads.map((r) => `${r.edgeStart.x},${r.edgeStart.y}|${r.edgeEnd.x},${r.edgeEnd.y}`);
    expect(new Set(keys).size).toBe(3);
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
