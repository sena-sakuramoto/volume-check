jest.mock('@/lib/remote-zip', () => ({
  fetchZipEntry: jest.fn(async () => null),
}));

jest.mock('@/lib/mvt-utils', () => ({
  featureGeometryToLatLng: jest.fn(() => []),
  latLngToPixel: jest.fn(() => ({ pixelX: 0, pixelY: 0 })),
  latLngToTile: jest.fn(() => ({ tileX: 14544, tileY: 6450 })),
  pointInFeatureGeometry: jest.fn(() => true),
}));

import { POST } from '../route';
import { fetchZipEntry } from '@/lib/remote-zip';
import {
  featureGeometryToLatLng,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';

type RouteRequest = Parameters<typeof POST>[0];

jest.mock('pbf', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@mapbox/vector-tile', () => ({
  VectorTile: jest.fn(),
}));

import { VectorTile } from '@mapbox/vector-tile';

describe('/api/plateau-landuse-lookup', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('returns 400 when latitude is invalid', async () => {
    const req = new Request('http://localhost/api/plateau-landuse-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 95, lng: 139.7 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(400);
  });

  test('returns site geometry from a matching landuse feature', async () => {
    (fetchZipEntry as jest.Mock).mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    const feature = {
      extent: 4096,
      properties: { class: 'residential' },
      loadGeometry: () => [
        [
          { x: 100, y: 100 },
          { x: 180, y: 100 },
          { x: 180, y: 180 },
          { x: 100, y: 180 },
        ],
      ],
    };
    (VectorTile as jest.Mock).mockImplementation(() => ({
      layers: {
        luse: {
          length: 1,
          feature: () => feature,
        },
      },
    }));
    (latLngToTile as jest.Mock).mockReturnValue({ tileX: 14544, tileY: 6450 });
    (latLngToPixel as jest.Mock).mockReturnValue({ pixelX: 120, pixelY: 340 });
    (pointInFeatureGeometry as jest.Mock).mockReturnValue(true);
    (featureGeometryToLatLng as jest.Mock).mockReturnValue([
      [
        [139.7135, 35.6335],
        [139.7137, 35.6335],
        [139.7137, 35.6337],
        [139.7135, 35.6337],
      ],
    ]);

    const req = new Request('http://localhost/api/plateau-landuse-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.633624, lng: 139.713613 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.source).toBe('plateau-landuse');
    expect(body.site.area).toBeGreaterThan(100);
    expect(body.siteCoordinates).toHaveLength(4);
    expect(body.matchMode).toBe('contains');
  });

  test('scans all layers and picks the smallest containing polygon', async () => {
    (fetchZipEntry as jest.Mock).mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    const largeFeature = {
      extent: 4096,
      properties: { class: 'large' },
      loadGeometry: () => [
        [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      ],
    };
    const smallFeature = {
      extent: 4096,
      properties: { class: 'small' },
      loadGeometry: () => [
        [
          { x: 100, y: 100 },
          { x: 220, y: 100 },
          { x: 220, y: 220 },
          { x: 100, y: 220 },
        ],
      ],
    };
    (VectorTile as jest.Mock).mockImplementation(() => ({
      layers: {
        type_111: {
          length: 1,
          feature: () => largeFeature,
        },
        type_unknown: {
          length: 1,
          feature: () => smallFeature,
        },
      },
    }));
    (latLngToTile as jest.Mock).mockReturnValue({ tileX: 14544, tileY: 6450 });
    (latLngToPixel as jest.Mock).mockReturnValue({ pixelX: 120, pixelY: 120 });
    (pointInFeatureGeometry as jest.Mock)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    (featureGeometryToLatLng as jest.Mock)
      .mockReturnValueOnce([
        [
          [139.7130, 35.6330],
          [139.7140, 35.6330],
          [139.7140, 35.6340],
          [139.7130, 35.6340],
        ],
      ])
      .mockReturnValueOnce([
        [
          [139.7135, 35.6335],
          [139.7137, 35.6335],
          [139.7137, 35.6337],
          [139.7135, 35.6337],
        ],
      ]);

    const req = new Request('http://localhost/api/plateau-landuse-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: 35.633624, lng: 139.713613 }),
    });

    const res = await POST(req as RouteRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.attributes.class).toBe('small');
    expect(body.matchMode).toBe('contains');
  });
});
