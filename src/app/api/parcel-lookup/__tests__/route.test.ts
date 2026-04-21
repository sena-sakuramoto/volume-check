jest.mock('pmtiles', () => {
  return {
    PMTiles: class {
      constructor(public url: string) {}
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

import { POST, __testing } from '../route';

type RouteRequest = Parameters<typeof POST>[0];

const originalFetch = global.fetch;

function mockCurrentTxt(body: string | null, status = 200): jest.Mock {
  const fn = jest.fn(async (url: RequestInfo | URL) => {
    const href = typeof url === 'string' ? url : url.toString();
    if (href.includes('/current.txt')) {
      if (body === null) {
        return new Response('not found', { status: 404 });
      }
      return new Response(body, { status });
    }
    throw new Error(`unexpected fetch: ${href}`);
  });
  global.fetch = fn as unknown as typeof global.fetch;
  return fn;
}

describe('/api/parcel-lookup', () => {
  beforeEach(() => {
    __testing.resetCaches();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  test('accepts numeric strings including full-width digits', async () => {
    mockCurrentTxt(null);
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
    mockCurrentTxt(null);
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

  test('falls back to AMX when current.txt is missing (no throw)', async () => {
    const fetchMock = mockCurrentTxt(null, 404);
    const req = new Request('http://localhost/api/parcel-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.69, lng: 139.69 }),
    });
    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    const body = await res.json();
    expect(Array.isArray(body.parcels)).toBe(true);
  });

  test('rejects malformed current.txt — getMojPmtiles returns null', async () => {
    mockCurrentTxt('not a valid key');
    const moj = await __testing.getMojPmtiles();
    expect(moj).toBeNull();
  });

  test('rejects empty current.txt — getMojPmtiles returns null', async () => {
    mockCurrentTxt('');
    const moj = await __testing.getMojPmtiles();
    expect(moj).toBeNull();
  });

  test('accepts well-formed current.txt — getMojPmtiles returns a PMTiles', async () => {
    mockCurrentTxt('moj/mojmap-20260421-030000.pmtiles');
    const moj = await __testing.getMojPmtiles();
    expect(moj).not.toBeNull();
  });

  test('getMojPmtiles caches within TTL and does not re-fetch current.txt', async () => {
    const fetchMock = mockCurrentTxt('moj/mojmap-20260421-030000.pmtiles');
    const first = await __testing.getMojPmtiles();
    const second = await __testing.getMojPmtiles();
    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
