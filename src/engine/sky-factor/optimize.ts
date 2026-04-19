import type { VolumeResult, SiteBoundary, Road } from '../types';
import { generateMeasurementPoints, type MeasurementPoint } from './measurement-points';
import { computeSkyFactorAt, type TriangleMesh } from './ray-trace';

export interface MaxVolumeSearchResult {
  /** max scale factor k (≥1) maintaining sky-factor parity */
  maxScale: number;
  /** iterations run */
  iterations: number;
  /** worst margin at max scale (value - baseline) */
  worstMargin: number;
  /** total elapsed ms */
  elapsedMs: number;
  /** baseline sky factor per point (for reporting) */
  baselinePerPoint: number[];
}

/**
 * Scale a triangle mesh uniformly around a centroid on the ground plane (XZ)
 * and scale Y from ground. Returns a new Float32Array (indices are unchanged).
 */
function scaleMesh(
  vertices: Float32Array,
  k: number,
  centroidXZ: { x: number; z: number },
): Float32Array {
  const out = new Float32Array(vertices.length);
  for (let i = 0; i < vertices.length; i += 3) {
    out[i + 0] = (vertices[i + 0] - centroidXZ.x) * k + centroidXZ.x;
    out[i + 1] = vertices[i + 1] * k; // height scales from ground (y=0)
    out[i + 2] = (vertices[i + 2] - centroidXZ.z) * k + centroidXZ.z;
  }
  return out;
}

function centroidXZ(vertices: Float32Array): { x: number; z: number } {
  let sx = 0,
    sz = 0,
    n = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    sx += vertices[i + 0];
    sz += vertices[i + 2];
    n++;
  }
  return n ? { x: sx / n, z: sz / n } : { x: 0, z: 0 };
}

/**
 * Binary-search the largest uniform scale factor k ≥ 1 such that the sky
 * factor of the dilated envelope is ≥ the baseline envelope's sky factor at
 * every measurement point.
 *
 * This models 建基法 56条7項 relaxation: a proposed volume may exceed 斜線制限
 * provided its 天空率 is ≥ the 斜線限界 envelope's 天空率 at every 測定点.
 */
export async function searchMaxSkyVolume(
  site: SiteBoundary,
  roads: Road[],
  baseline: VolumeResult,
  opts: {
    minScale?: number;
    maxScale?: number;
    iterations?: number;
    azSteps?: number;
    elSteps?: number;
    maxPoints?: number;
    /** yield back to the UI between iterations */
    onProgress?: (info: { iter: number; lo: number; hi: number }) => void;
  } = {},
): Promise<MaxVolumeSearchResult> {
  const start = performance.now();
  const iterations = opts.iterations ?? 8;
  const minScale = opts.minScale ?? 1;
  const maxScale = opts.maxScale ?? 1.8;
  const azSteps = opts.azSteps ?? 64;
  const elSteps = opts.elSteps ?? 32;

  const allPoints = generateMeasurementPoints(site, roads);
  const points: MeasurementPoint[] =
    opts.maxPoints && allPoints.length > opts.maxPoints
      ? subsample(allPoints, opts.maxPoints)
      : allPoints;

  const baselineMesh: TriangleMesh = {
    vertices: baseline.envelopeVertices,
    indices: baseline.envelopeIndices,
  };

  // Cache baseline sky factor per measurement point
  const baselineSF = points.map((mp) =>
    computeSkyFactorAt(mp.position, baselineMesh, { azSteps, elSteps }),
  );

  const cxz = centroidXZ(baseline.envelopeVertices);

  // Helper: check if scale k is feasible
  const feasible = (k: number): { ok: boolean; worstMargin: number } => {
    const vertices = scaleMesh(baseline.envelopeVertices, k, cxz);
    const mesh: TriangleMesh = { vertices, indices: baseline.envelopeIndices };
    let worst = Infinity;
    for (let i = 0; i < points.length; i++) {
      const sf = computeSkyFactorAt(points[i].position, mesh, { azSteps, elSteps });
      const margin = sf - baselineSF[i];
      if (margin < worst) worst = margin;
      if (worst < -0.005) return { ok: false, worstMargin: worst };
    }
    return { ok: worst >= -0.005, worstMargin: worst };
  };

  let lo = minScale;
  let hi = maxScale;
  let lastOk = minScale;
  let lastWorst = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const mid = (lo + hi) / 2;
    // yield a frame so we don't freeze the UI
    await new Promise((r) => setTimeout(r, 0));
    const { ok, worstMargin } = feasible(mid);
    if (ok) {
      lastOk = mid;
      lastWorst = worstMargin;
      lo = mid;
    } else {
      hi = mid;
    }
    opts.onProgress?.({ iter: iter + 1, lo, hi });
  }

  return {
    maxScale: lastOk,
    iterations,
    worstMargin: lastWorst,
    elapsedMs: performance.now() - start,
    baselinePerPoint: baselineSF,
  };
}

function subsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
