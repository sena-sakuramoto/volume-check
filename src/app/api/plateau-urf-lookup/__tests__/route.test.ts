jest.mock('@/lib/mvt-utils', () => ({
  fetchMvtTile: jest.fn(async () => null),
  latLngToPixel: jest.fn(() => ({ pixelX: 0, pixelY: 0 })),
  latLngToTile: jest.fn(() => ({ tileX: 1, tileY: 2 })),
  pointInFeatureGeometry: jest.fn(() => true),
}));

import { POST } from '../route';
import {
  fetchMvtTile,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';

type RouteRequest = Parameters<typeof POST>[0];

type MockTileFeature = {
  extent: number;
  properties: Record<string, unknown>;
};

function createMockTile(properties: Record<string, unknown>) {
  const feature: MockTileFeature = {
    extent: 256,
    properties,
  };

  return {
    layers: {
      mock: {
        length: 1,
        feature: () => feature,
      },
    },
  };
}

describe('/api/plateau-urf-lookup', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('accepts numeric strings including full-width digits', async () => {
    const req = new Request('http://localhost/api/plateau-urf-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: '３５.６３', lng: '139.71' }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      heightDistrict: null,
      fireDistrict: null,
      districtPlan: null,
      useDistrict: null,
    });
  });

  test('returns 400 when latitude is out of range', async () => {
    const req = new Request('http://localhost/api/plateau-urf-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 95, lng: 139.71 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
  });

  test('extracts PLATEAU district data from tile attributes', async () => {
    (latLngToTile as jest.Mock).mockReturnValue({ tileX: 1, tileY: 2 });
    (latLngToPixel as jest.Mock).mockReturnValue({ pixelX: 12, pixelY: 34 });
    (pointInFeatureGeometry as jest.Mock).mockReturnValue(true);
    (fetchMvtTile as jest.Mock)
      .mockResolvedValueOnce(createMockTile({
        attributes: JSON.stringify({
          function: '第2種高度地区',
          maximumBuildingHeight: 20,
          slopeRatio: 1.25,
          districtPlanName: '神田地区計画',
          districtPlanRegulation: '壁面位置の制限あり',
        }),
      }))
      .mockResolvedValueOnce(createMockTile({
        attributes: JSON.stringify({
          function: '防火地域',
        }),
      }))
      .mockResolvedValueOnce(createMockTile({
        attributes: JSON.stringify({
          districtsAndZonesType: '商業地域',
          floorAreaRatio: 500,
          buildingCoverageRatio: 80,
        }),
      }));

    const req = new Request('http://localhost/api/plateau-urf-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.69, lng: 139.70 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.heightDistrict).toMatchObject({
      type: '第2種高度地区',
      maxHeight: 20,
      slopeRatio: 1.25,
    });
    expect(body.fireDistrict).toMatchObject({ type: '防火地域' });
    expect(body.districtPlan).toMatchObject({
      name: '神田地区計画',
      restrictions: '壁面位置の制限あり',
      maxHeight: 20,
    });
    expect(body.useDistrict).toMatchObject({
      district: '商業地域',
      floorAreaRatio: 5,
      coverageRatio: 0.8,
    });
  });
});