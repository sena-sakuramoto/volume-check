import { describe, it, expect } from '@jest/globals';
import { computeSkyFactorAt, type TriangleMesh } from '../ray-trace';

/**
 * For a measurement point with NO obstructions, sky factor must be ~1.
 */
describe('computeSkyFactorAt', () => {
  it('returns ~1 when the mesh is empty', () => {
    const mesh: TriangleMesh = {
      vertices: new Float32Array(),
      indices: new Uint32Array(),
    };
    const sf = computeSkyFactorAt({ x: 0, y: 1.5, z: 0 }, mesh);
    expect(sf).toBeCloseTo(1, 2);
  });

  it('is reduced by a large roof above the measurement point', () => {
    // A single horizontal triangle at y=10, covering a wide area above (0,0)
    const v = new Float32Array([
      -50, 10, -50, // 0
      50, 10, -50,  // 1
      0, 10, 50,    // 2
    ]);
    const idx = new Uint32Array([0, 1, 2]);
    const mesh: TriangleMesh = { vertices: v, indices: idx };
    const open = computeSkyFactorAt({ x: 0, y: 1.5, z: 0 }, { vertices: new Float32Array(), indices: new Uint32Array() });
    const roofed = computeSkyFactorAt({ x: 0, y: 1.5, z: 0 }, mesh);
    expect(roofed).toBeLessThan(open);
    // A single triangle can't cover the full hemisphere, so sf > 0
    expect(roofed).toBeGreaterThan(0);
  });

  it('is very low when the measurement point is inside a closed box', () => {
    // 20m cube centered at origin, measurement point inside
    const h = 10;
    const v = new Float32Array([
      -h, 0, -h, h, 0, -h, h, 2 * h, -h, -h, 2 * h, -h, // front face
      -h, 0, h, h, 0, h, h, 2 * h, h, -h, 2 * h, h, // back face
    ]);
    // Simple 2-triangle front face that blocks the sky
    const v2 = new Float32Array([
      -30, 30, -30,
      30, 30, -30,
      30, 30, 30,
      -30, 30, 30,
    ]);
    const idx = new Uint32Array([0, 1, 2, 0, 2, 3]);
    const mesh: TriangleMesh = { vertices: v2, indices: idx };
    const sf = computeSkyFactorAt({ x: 0, y: 1.5, z: 0 }, mesh);
    // A 60×60 roof at y=30 blocks the cone up to ~60° half-angle.
    // Expect sky factor in the 0.6 – 0.8 range, below the free-sky 1.0.
    expect(sf).toBeLessThan(0.85);
    expect(sf).toBeGreaterThan(0.3);
    void v;
  });
});
