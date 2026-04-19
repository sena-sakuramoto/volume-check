import type { VolumeResult, Road, SiteBoundary } from '../types';
import {
  generateMeasurementPoints,
  type MeasurementPoint,
  type MeasurementPointKind,
} from './measurement-points';
import { computeSkyFactorAt, type TriangleMesh } from './ray-trace';

export interface SkyFactorPointResult extends MeasurementPoint {
  /** current envelope sky factor */
  value: number;
  /** baseline (斜線限界 envelope) sky factor */
  baseline: number;
  /** value - baseline. positive = 緩和適合 */
  margin: number;
  /** value - baseline as ratio */
  marginPct: number;
  pass: boolean;
}

export interface SkyFactorAnalysis {
  points: SkyFactorPointResult[];
  /** Aggregate: min / mean / worst-margin */
  summary: {
    minValue: number;
    minBaseline: number;
    worstMarginPct: number;
    allPass: boolean;
    failCount: number;
  };
  /** Grouped counts by kind for UI */
  byKind: Record<MeasurementPointKind, number>;
}

/**
 * Analyze an envelope against a baseline (斜線限界) envelope.
 *
 * Both meshes are expected in the same local coordinate system as the site.
 */
export function analyzeSkyFactor(
  site: SiteBoundary,
  roads: Road[],
  current: VolumeResult,
  baseline: VolumeResult,
  opts: { azSteps?: number; elSteps?: number; maxPoints?: number } = {},
): SkyFactorAnalysis {
  const allPoints = generateMeasurementPoints(site, roads);
  const points =
    opts.maxPoints && allPoints.length > opts.maxPoints
      ? subsample(allPoints, opts.maxPoints)
      : allPoints;

  const currentMesh: TriangleMesh = {
    vertices: current.envelopeVertices,
    indices: current.envelopeIndices,
  };
  const baselineMesh: TriangleMesh = {
    vertices: baseline.envelopeVertices,
    indices: baseline.envelopeIndices,
  };

  const results: SkyFactorPointResult[] = points.map((mp) => {
    const value = computeSkyFactorAt(mp.position, currentMesh, opts);
    const bv = computeSkyFactorAt(mp.position, baselineMesh, opts);
    const margin = value - bv;
    const marginPct = bv > 0 ? (margin / bv) * 100 : 0;
    return {
      ...mp,
      value,
      baseline: bv,
      margin,
      marginPct,
      pass: value >= bv,
    };
  });

  let minValue = 1,
    minBaseline = 1,
    worstMarginPct = Infinity;
  let failCount = 0;
  for (const r of results) {
    if (r.value < minValue) minValue = r.value;
    if (r.baseline < minBaseline) minBaseline = r.baseline;
    if (r.marginPct < worstMarginPct) worstMarginPct = r.marginPct;
    if (!r.pass) failCount++;
  }
  if (!Number.isFinite(worstMarginPct)) worstMarginPct = 0;

  const byKind: Record<MeasurementPointKind, number> = {
    road: 0,
    adjacent: 0,
    north: 0,
  };
  for (const r of results) byKind[r.kind]++;

  return {
    points: results,
    summary: {
      minValue,
      minBaseline,
      worstMarginPct,
      allPass: failCount === 0,
      failCount,
    },
    byKind,
  };
}

function subsample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}
