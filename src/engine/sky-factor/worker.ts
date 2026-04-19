/// <reference lib="webworker" />

import { analyzeSkyFactor, type SkyFactorAnalysis } from './analyze';
import { searchMaxSkyVolume, type MaxVolumeSearchResult } from './optimize';
import type { SiteBoundary, Road, VolumeResult } from '../types';

declare const self: DedicatedWorkerGlobalScope;

type AnalyzeMessage = {
  type: 'analyze';
  site: SiteBoundary;
  roads: Road[];
  current: VolumeResult;
  baseline: VolumeResult;
  options?: { azSteps?: number; elSteps?: number; maxPoints?: number };
};

type OptimizeMessage = {
  type: 'optimize';
  site: SiteBoundary;
  roads: Road[];
  baseline: VolumeResult;
  options?: {
    azSteps?: number;
    elSteps?: number;
    iterations?: number;
    maxPoints?: number;
    minScale?: number;
    maxScale?: number;
  };
};

type InMessage = AnalyzeMessage | OptimizeMessage;

type AnalyzeResult = { type: 'analyze-done'; result: SkyFactorAnalysis };
type OptimizeProgress = {
  type: 'optimize-progress';
  iter: number;
  lo: number;
  hi: number;
};
type OptimizeResult = { type: 'optimize-done'; result: MaxVolumeSearchResult };
type ErrorResult = { type: 'error'; message: string };

export type WorkerOutMessage =
  | AnalyzeResult
  | OptimizeProgress
  | OptimizeResult
  | ErrorResult;

/**
 * Float32Array / Uint32Array survive structuredClone, but nested objects like
 * VolumeResult carry many other fields we don't need for sky-factor math.
 * The caller should pass only the bits required; we re-hydrate minimal mesh
 * defaults for the unused fields so analyze/optimize can run.
 */
function hydrateVolume(v: VolumeResult): VolumeResult {
  return {
    ...v,
    envelopeVertices: new Float32Array(v.envelopeVertices),
    envelopeIndices: new Uint32Array(v.envelopeIndices),
  };
}

self.onmessage = async (ev: MessageEvent<InMessage>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'analyze') {
      const result = analyzeSkyFactor(
        msg.site,
        msg.roads,
        hydrateVolume(msg.current),
        hydrateVolume(msg.baseline),
        msg.options,
      );
      self.postMessage({ type: 'analyze-done', result } satisfies AnalyzeResult);
    } else if (msg.type === 'optimize') {
      const result = await searchMaxSkyVolume(
        msg.site,
        msg.roads,
        hydrateVolume(msg.baseline),
        {
          ...msg.options,
          onProgress: ({ iter, lo, hi }) =>
            self.postMessage({
              type: 'optimize-progress',
              iter,
              lo,
              hi,
            } satisfies OptimizeProgress),
        },
      );
      self.postMessage({ type: 'optimize-done', result } satisfies OptimizeResult);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    self.postMessage({ type: 'error', message } satisfies ErrorResult);
  }
};
