import type { SkyFactorAnalysis } from './analyze';
import type { MaxVolumeSearchResult } from './optimize';
import type { WorkerOutMessage } from './worker';
import type { Road, SiteBoundary, VolumeResult } from '../types';

/**
 * Client-side wrapper for the sky-factor web worker. Each call spawns a fresh
 * worker to avoid lingering state between runs; the worker is terminated on
 * completion or error.
 */

function spawn(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
}

function stripVolume(v: VolumeResult): VolumeResult {
  // Minimal shape; only the mesh is used by the worker.
  return {
    ...v,
    envelopeVertices: v.envelopeVertices,
    envelopeIndices: v.envelopeIndices,
  };
}

export interface AnalyzeOpts {
  azSteps?: number;
  elSteps?: number;
  maxPoints?: number;
}

export function analyzeInWorker(
  site: SiteBoundary,
  roads: Road[],
  current: VolumeResult,
  baseline: VolumeResult,
  options: AnalyzeOpts = {},
): Promise<SkyFactorAnalysis> {
  return new Promise((resolve, reject) => {
    const w = spawn();
    w.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
      const m = ev.data;
      if (m.type === 'analyze-done') {
        w.terminate();
        resolve(m.result);
      } else if (m.type === 'error') {
        w.terminate();
        reject(new Error(m.message));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || 'worker error'));
    };
    w.postMessage({
      type: 'analyze',
      site,
      roads,
      current: stripVolume(current),
      baseline: stripVolume(baseline),
      options,
    });
  });
}

export interface OptimizeOpts {
  azSteps?: number;
  elSteps?: number;
  iterations?: number;
  maxPoints?: number;
  minScale?: number;
  maxScale?: number;
  onProgress?: (p: { iter: number; lo: number; hi: number }) => void;
}

export function optimizeInWorker(
  site: SiteBoundary,
  roads: Road[],
  baseline: VolumeResult,
  options: OptimizeOpts = {},
): Promise<MaxVolumeSearchResult> {
  const { onProgress, ...rest } = options;
  return new Promise((resolve, reject) => {
    const w = spawn();
    w.onmessage = (ev: MessageEvent<WorkerOutMessage>) => {
      const m = ev.data;
      if (m.type === 'optimize-progress') {
        onProgress?.({ iter: m.iter, lo: m.lo, hi: m.hi });
      } else if (m.type === 'optimize-done') {
        w.terminate();
        resolve(m.result);
      } else if (m.type === 'error') {
        w.terminate();
        reject(new Error(m.message));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || 'worker error'));
    };
    w.postMessage({
      type: 'optimize',
      site,
      roads,
      baseline: stripVolume(baseline),
      options: rest,
    });
  });
}
