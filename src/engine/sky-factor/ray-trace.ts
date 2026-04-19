import type { Point3D } from '../types';

/**
 * Hemispheric ray-tracing sky factor.
 *
 * Sky factor = (unobstructed rays) / (total rays)
 *
 * For each hemisphere direction (az, el), cast a ray from the measurement
 * point upward-ish. If the ray hits any triangle of the building mesh, it's
 * obstructed. Otherwise counts toward "sky".
 *
 * We use a modest 64x128 grid (=8192 rays) per point — that's ~±0.5% accuracy
 * and runs in <50ms for a few hundred triangles in pure JS.
 */

const DEFAULT_AZ_STEPS = 128;
const DEFAULT_EL_STEPS = 64;

export interface SkyFactorOptions {
  azSteps?: number;
  elSteps?: number;
}

export interface TriangleMesh {
  vertices: Float32Array; // length = triCount*3*3
  indices: Uint32Array; // length = triCount*3
}

/**
 * Pre-compute triangle data for efficient ray-tests.
 */
function bakeTriangles(mesh: TriangleMesh): Float32Array {
  const { vertices, indices } = mesh;
  const triCount = indices.length / 3;
  const out = new Float32Array(triCount * 9);
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k];
      out[t * 9 + k * 3 + 0] = vertices[vi * 3 + 0];
      out[t * 9 + k * 3 + 1] = vertices[vi * 3 + 1];
      out[t * 9 + k * 3 + 2] = vertices[vi * 3 + 2];
    }
  }
  return out;
}

/**
 * Möller–Trumbore ray-triangle intersection. Returns true if ray hits the tri
 * with t > 0 (i.e. in front of origin).
 */
function rayHitsTri(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  tris: Float32Array,
  triIndex: number,
): boolean {
  const base = triIndex * 9;
  const ax = tris[base + 0],
    ay = tris[base + 1],
    az = tris[base + 2];
  const bx = tris[base + 3],
    by = tris[base + 4],
    bz = tris[base + 5];
  const cx = tris[base + 6],
    cy = tris[base + 7],
    cz = tris[base + 8];

  const e1x = bx - ax,
    e1y = by - ay,
    e1z = bz - az;
  const e2x = cx - ax,
    e2y = cy - ay,
    e2z = cz - az;

  // h = d × e2
  const hx = dy * e2z - dz * e2y;
  const hy = dz * e2x - dx * e2z;
  const hz = dx * e2y - dy * e2x;

  const a = e1x * hx + e1y * hy + e1z * hz;
  if (a > -1e-9 && a < 1e-9) return false;
  const f = 1 / a;

  const sx = ox - ax,
    sy = oy - ay,
    sz = oz - az;
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return false;

  // q = s × e1
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = f * (dx * qx + dy * qy + dz * qz);
  if (v < 0 || u + v > 1) return false;

  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > 1e-4; // in front of origin
}

/**
 * Compute sky factor at a measurement point for a given triangle mesh.
 *
 * Returns number in [0, 1].
 */
export function computeSkyFactorAt(
  origin: Point3D,
  mesh: TriangleMesh,
  options: SkyFactorOptions = {},
): number {
  const azSteps = options.azSteps ?? DEFAULT_AZ_STEPS;
  const elSteps = options.elSteps ?? DEFAULT_EL_STEPS;
  const tris = bakeTriangles(mesh);
  const triCount = mesh.indices.length / 3;

  let total = 0;
  let sky = 0;

  for (let i = 0; i < elSteps; i++) {
    // elevation 0..π/2 (horizon..zenith)
    const el = ((i + 0.5) / elSteps) * (Math.PI / 2);
    const sinEl = Math.sin(el);
    const cosEl = Math.cos(el);
    // weight by cos(el) for cosine-weighted hemisphere (solid-angle uniform)
    const weight = cosEl;
    for (let j = 0; j < azSteps; j++) {
      const az = ((j + 0.5) / azSteps) * 2 * Math.PI;
      const dx = cosEl * Math.sin(az);
      const dy = sinEl;
      const dz = cosEl * Math.cos(az);

      total += weight;

      let hit = false;
      for (let t = 0; t < triCount; t++) {
        if (rayHitsTri(origin.x, origin.y, origin.z, dx, dy, dz, tris, t)) {
          hit = true;
          break;
        }
      }
      if (!hit) sky += weight;
    }
  }

  return total > 0 ? sky / total : 1;
}
