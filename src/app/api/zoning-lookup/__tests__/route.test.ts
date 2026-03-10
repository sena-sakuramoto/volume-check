jest.mock('@/lib/mvt-utils', () => ({
  fetchMvtTile: jest.fn(async () => null),
  latLngToPixel: jest.fn(() => ({ pixelX: 0, pixelY: 0 })),
  latLngToTile: jest.fn(() => ({ tileX: 1, tileY: 2 })),
  pointInFeatureGeometry: jest.fn(() => false),
}));

import { POST } from '../route';

type RouteRequest = Parameters<typeof POST>[0];
import {
  fetchMvtTile,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';

describe('/api/zoning-lookup', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('accepts numeric strings including full-width digits', async () => {
    const req = new Request('http://localhost/api/zoning-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: '３５．６３', lng: '139.71' }),
    });

    const res = await POST(req as RouteRequest);
    // fetchMvtTile mock returns null => no feature => 404 proves parsing passed
    expect(res.status).toBe(404);
  });

  test('returns 400 when longitude is out of range', async () => {
    const req = new Request('http://localhost/api/zoning-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.63, lng: 181 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('経度(lng)は-180〜180');
  });

  test('敷地ポリゴンを渡すと重なり用途地域の比率を返す', async () => {
    const features = [
      {
        type: 3,
        extent: 256,
        properties: {
          kind: 'commercial',
          用途地域: '商業地域',
          建ぺい率: 80,
          容積率: 500,
          防火地域: '防火地域',
        },
        loadGeometry: () => [[
          { x: 0, y: 0 },
          { x: 256, y: 0 },
          { x: 256, y: 256 },
          { x: 0, y: 256 },
        ]],
      },
      {
        type: 3,
        extent: 256,
        properties: {
          kind: 'neighborhood',
          用途地域: '近隣商業地域',
          建ぺい率: 80,
          容積率: 300,
          防火地域: '準防火地域',
        },
        loadGeometry: () => [[
          { x: 0, y: 0 },
          { x: 256, y: 0 },
          { x: 256, y: 256 },
          { x: 0, y: 256 },
        ]],
      },
    ];

    (latLngToTile as jest.Mock).mockReturnValue({ tileX: 1, tileY: 2 });

    (fetchMvtTile as jest.Mock).mockResolvedValue({
      layers: {
        hits: {
          length: features.length,
          feature: (i: number) => features[i],
        },
      },
    });

    (latLngToPixel as jest.Mock).mockImplementation((lat: number, lng: number) => ({
      pixelX: Math.round((lng - 139.7000) * 1_000_000),
      pixelY: Math.round((35.6903 - lat) * 1_000_000),
    }));

    (pointInFeatureGeometry as jest.Mock).mockImplementation(
      (x: number, _y: number, feature: { properties: { kind: string } }) => {
        if (feature.properties.kind === 'commercial') return x < 100;
        if (feature.properties.kind === 'neighborhood') return x >= 100;
        return false;
      },
    );

    const req = new Request('http://localhost/api/zoning-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 35.69015,
        lng: 139.70005,
        siteCoordinates: [
          [139.7000, 35.6903],
          [139.7002, 35.6903],
          [139.7002, 35.6901],
          [139.7000, 35.6901],
        ],
      }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.districts)).toBe(true);
    expect(body.districts).toHaveLength(2);
    const names = body.districts.map((d: { district: string }) => d.district);
    expect(names).toContain('商業地域');
    expect(names).toContain('近隣商業地域');
  });
});
