import {
  buildApproximateRectGeoRing,
  extractGeoRingFromPayload,
  buildSiteFromGeoRing,
  inferDefaultRoadFromVertices,
} from '../site-shape';

describe('site-shape utilities', () => {
  it('extracts a polygon ring from GeoJSON FeatureCollection', () => {
    const payload = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [139.7000, 35.6900],
              [139.7001, 35.6900],
              [139.7001, 35.6901],
              [139.7000, 35.6901],
              [139.7000, 35.6900],
            ]],
          },
          properties: {},
        },
      ],
    };

    const ring = extractGeoRingFromPayload(payload);
    expect(ring).not.toBeNull();
    expect(ring).toHaveLength(4); // closing duplicated point should be removed
  });

  it('builds local-meter site geometry with positive area', () => {
    const ring = [
      { lat: 35.6900, lng: 139.7000 },
      { lat: 35.6900, lng: 139.7001 },
      { lat: 35.6901, lng: 139.7001 },
      { lat: 35.6901, lng: 139.7000 },
    ];

    const site = buildSiteFromGeoRing(ring);
    expect(site).not.toBeNull();
    expect(site!.vertices).toHaveLength(4);
    expect(site!.area).toBeGreaterThan(50);
    expect(site!.area).toBeLessThan(150);
  });

  it('infers a default road along the longest edge', () => {
    const vertices = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];

    const road = inferDefaultRoadFromVertices(vertices, 6);
    expect(road).not.toBeNull();
    expect(road!.width).toBe(6);
    expect(road!.centerOffset).toBe(3);
  });

  it('builds an approximate rectangular ring around a point', () => {
    const ring = buildApproximateRectGeoRing(35.633624, 139.713613, {
      width: 12,
      depth: 20,
    });

    expect(ring).not.toBeNull();
    expect(ring).toHaveLength(4);

    const site = buildSiteFromGeoRing(ring!);
    expect(site).not.toBeNull();
    expect(site!.area).toBeGreaterThan(200);
    expect(site!.area).toBeLessThan(280);
  });
});
