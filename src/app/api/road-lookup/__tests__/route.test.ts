jest.mock('@/lib/site-shape', () => ({
  buildSiteFromGeoRing: jest.fn(() => ({
    area: 100,
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  })),
}));

jest.mock('@/lib/road-inference', () => ({
  inferRoadEdgesFromGeometry: jest.fn(() => [
    {
      edgeVertexIndices: [0, 1],
      width: 6,
      direction: 'south',
      distance: 0,
    },
  ]),
  inferRoadEdgesFromLines: jest.fn(() => [
    {
      edgeVertexIndices: [1, 2],
      width: 8,
      direction: 'east',
      distance: 1.5,
      name: '靖国通り',
      highway: 'primary',
    },
  ]),
}));

import { POST } from '../route';
import { inferRoadEdgesFromGeometry, inferRoadEdgesFromLines } from '@/lib/road-inference';

type RouteRequest = Parameters<typeof POST>[0];

describe('/api/road-lookup', () => {
  const originalFetch = global.fetch;
  const caches = globalThis as typeof globalThis & {
    __volumeCheckRoadLookupCaches?: {
      overpass: Map<string, unknown>;
      response: Map<string, unknown>;
    };
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    caches.__volumeCheckRoadLookupCaches?.overpass.clear();
    caches.__volumeCheckRoadLookupCaches?.response.clear();
  });

  test('returns 400 when siteCoordinates are missing', async () => {
    const req = new Request('http://localhost/api/road-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.69, lng: 139.70 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
  });

  test('falls back to geometry heuristic when Overpass yields no roads', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const req = new Request('http://localhost/api/road-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: '35.69',
        lng: '139.70',
        siteCoordinates: [
          [139.70, 35.69],
          [139.7001, 35.69],
          [139.7001, 35.6901],
          [139.70, 35.6901],
        ],
      }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.source).toBe('geometry-heuristic');
    expect(body.roadLineCount).toBe(0);
    expect(Array.isArray(body.roads)).toBe(true);
    expect(body.roads[0]).toMatchObject({
      edgeVertexIndices: [0, 1],
      direction: 'south',
      width: 6,
      confidence: 'low',
      sourceLabel: '敷地形状ヒューリスティック',
    });
    expect(typeof body.roads[0].reasoning).toBe('string');
    expect(inferRoadEdgesFromGeometry).toHaveBeenCalled();
  });

  test('returns OSM-inferred roads when Overpass data is available', async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({
        elements: [
          {
            type: 'way',
            tags: { highway: 'primary', name: '靖国通り' },
            geometry: [
              { lat: 35.69, lon: 139.70 },
              { lat: 35.6901, lon: 139.7001 },
            ],
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as typeof fetch;

    const req = new Request('http://localhost/api/road-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 35.69,
        lng: 139.70,
        siteCoordinates: [
          [139.70, 35.69],
          [139.7001, 35.69],
          [139.7001, 35.6901],
          [139.70, 35.6901],
        ],
      }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.source).toBe('osm-overpass');
    expect(body.roadLineCount).toBe(1);
    expect(body.roads[0]).toMatchObject({
      edgeVertexIndices: [1, 2],
      direction: 'east',
      width: 8,
      name: '靖国通り',
      highway: 'primary',
      confidence: 'high',
      sourceLabel: 'OpenStreetMap / Overpass API',
    });
    expect(typeof body.roads[0].reasoning).toBe('string');
    expect(inferRoadEdgesFromLines).toHaveBeenCalled();
  });
});
