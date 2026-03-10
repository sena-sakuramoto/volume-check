jest.mock('pmtiles', () => {
  return {
    PMTiles: class {
      constructor() {}
      async getZxy() {
        return { data: new ArrayBuffer(0) };
      }
    },
  };
});

jest.mock('@/lib/mvt-utils', () => ({
  featureGeometryToLatLng: jest.fn(() => []),
  latLngToPixel: jest.fn(() => ({ pixelX: 0, pixelY: 0 })),
  latLngToTile: jest.fn(() => ({ tileX: 1, tileY: 2 })),
  pointInFeatureGeometry: jest.fn(() => false),
}));

import { POST } from '../route';

type RouteRequest = Parameters<typeof POST>[0];

describe('/api/parcel-lookup', () => {
  test('accepts numeric strings including full-width digits', async () => {
    const req = new Request('http://localhost/api/parcel-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: '３５．６３', lng: '139.71' }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.parcels)).toBe(true);
  });

  test('returns 400 when latitude is out of range', async () => {
    const req = new Request('http://localhost/api/parcel-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 95, lng: 139.71 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('緯度(lat)は-90〜90');
  });
});
