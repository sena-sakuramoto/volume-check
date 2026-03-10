import { POST } from '../route';

type RouteRequest = Parameters<typeof POST>[0];

describe('/api/site-shape-lookup', () => {
  const originalEndpoint = process.env.PARCEL_SHAPE_API_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.PARCEL_SHAPE_API_URL;
    } else {
      process.env.PARCEL_SHAPE_API_URL = originalEndpoint;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('accepts numeric strings including full-width digits', async () => {
    delete process.env.PARCEL_SHAPE_API_URL;

    const req = new Request('http://localhost/api/site-shape-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: '３５．６３', lng: '139.71' }),
    });

    const res = await POST(req as RouteRequest);
    // endpoint unset => 503 proves parsing passed
    expect(res.status).toBe(503);
  });

  test('returns 400 when latitude is out of range', async () => {
    delete process.env.PARCEL_SHAPE_API_URL;

    const req = new Request('http://localhost/api/site-shape-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 95, lng: 139.71 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('緯度(lat)は-90〜90');
  });

  test('returns siteCoordinates when parcel shape API yields a geo polygon', async () => {
    process.env.PARCEL_SHAPE_API_URL = 'https://example.test/parcel-shape';

    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [139.7100, 35.6330],
              [139.7102, 35.6330],
              [139.7102, 35.6332],
              [139.7100, 35.6332],
              [139.7100, 35.6330],
            ]],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as typeof fetch;

    const req = new Request('http://localhost/api/site-shape-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.6331, lng: 139.7101 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body.siteCoordinates)).toBe(true);
    expect(body.siteCoordinates.length).toBeGreaterThanOrEqual(4);
    expect(body.siteCoordinates[0]).toEqual([139.71, 35.633]);
  });
});
