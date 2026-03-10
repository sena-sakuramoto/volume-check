import {
  inferRoadEdgesFromGeometry,
  inferRoadEdgesFromLines,
  type LocalRoadLine,
} from '../road-inference';

describe('road-inference', () => {
  test('道路線形から複数の接道境界を推定できる', () => {
    const siteVertices = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 15 },
      { x: 0, y: 15 },
    ];

    const roadLines: LocalRoadLine[] = [
      {
        width: 6,
        points: [
          { x: -10, y: -4 },
          { x: 30, y: -4 },
        ],
      },
      {
        width: 8,
        points: [
          { x: 24, y: -10 },
          { x: 24, y: 25 },
        ],
      },
    ];

    const inferred = inferRoadEdgesFromLines(siteVertices, roadLines, { maxDistance: 14 });
    const edges = inferred.map((r) => r.edgeVertexIndices);

    expect(edges).toContainEqual([0, 1]);
    expect(edges).toContainEqual([1, 2]);
    expect(inferred.find((r) => r.edgeVertexIndices[0] === 0)?.width).toBeCloseTo(6, 1);
    expect(inferred.find((r) => r.edgeVertexIndices[0] === 1)?.width).toBeCloseTo(8, 1);
  });
});

describe('road-inference (geometry fallback)', () => {
  test('道路データが無くても形状から複数辺を推定できる', () => {
    const siteVertices = [
      { x: 0, y: 0 },
      { x: 24, y: 0 },
      { x: 24, y: 10 },
      { x: 0, y: 10 },
    ];

    const inferred = inferRoadEdgesFromGeometry(siteVertices, 2);
    const edges = inferred.map((r) => r.edgeVertexIndices);
    expect(edges).toContainEqual([0, 1]);
    expect(edges).toContainEqual([2, 3]);
  });

  test('辺の方位を敷地重心基準で安定して判定する', () => {
    const siteVertices = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 12 },
      { x: 0, y: 12 },
    ];

    const inferred = inferRoadEdgesFromGeometry(siteVertices, 4);
    const map = new Map(inferred.map((item) => [item.edgeVertexIndices.join('-'), item.direction]));

    expect(map.get('0-1')).toBe('south');
    expect(map.get('1-2')).toBe('east');
    expect(map.get('2-3')).toBe('north');
    expect(map.get('3-0')).toBe('west');
  });
});
