import { describe, it, expect } from '@jest/globals';
import { searchMaxSkyVolume } from '../optimize';
import type { VolumeResult, Road, SiteBoundary } from '../../types';

const site: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 30 },
    { x: 0, y: 30 },
  ],
  area: 600,
};

const roads: Road[] = [
  {
    edgeStart: { x: 0, y: 0 },
    edgeEnd: { x: 20, y: 0 },
    width: 6,
    centerOffset: 3,
    bearing: 180,
  },
];

/** A 20x30x10m slab as the slant envelope (triangulated) */
function boxMesh(w: number, h: number, d: number): VolumeResult {
  const verts = new Float32Array([
    0, 0, 0, w, 0, 0, w, 0, d, 0, 0, d,  // bottom
    0, h, 0, w, h, 0, w, h, d, 0, h, d,  // top
  ]);
  const idx = new Uint32Array([
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ]);
  return {
    maxFloorArea: w * d * Math.ceil(h / 3),
    maxCoverageArea: w * d,
    maxHeight: h,
    maxFloors: Math.ceil(h / 3),
    envelopeVertices: verts,
    envelopeIndices: idx,
    setbackEnvelopes: {
      road: null,
      adjacent: null,
      north: null,
      absoluteHeight: null,
      shadow: null,
    },
    shadowProjection: null,
    heightFieldData: null,
    reverseShadow: null,
    buildingPatterns: null,
    buildablePolygon: null,
    shadowBoundary: null,
  };
}

describe('searchMaxSkyVolume', () => {
  it('returns a scale ≥ 1 for a small box on a normal site', async () => {
    const baseline = boxMesh(20, 10, 30);
    const result = await searchMaxSkyVolume(site, roads, baseline, {
      azSteps: 16,
      elSteps: 10,
      iterations: 4,
      maxPoints: 3,
      minScale: 1,
      maxScale: 1.5,
    });
    expect(result.maxScale).toBeGreaterThanOrEqual(1);
    expect(result.maxScale).toBeLessThanOrEqual(1.5);
  });

  it('reports baseline sky factor per point', async () => {
    const baseline = boxMesh(20, 10, 30);
    const result = await searchMaxSkyVolume(site, roads, baseline, {
      azSteps: 12,
      elSteps: 8,
      iterations: 2,
      maxPoints: 2,
    });
    expect(result.baselinePerPoint.length).toBeGreaterThan(0);
    for (const sf of result.baselinePerPoint) {
      expect(sf).toBeGreaterThan(0);
      expect(sf).toBeLessThanOrEqual(1);
    }
  });
});
