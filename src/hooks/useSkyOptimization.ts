'use client';

import { useCallback, useState } from 'react';
import type { VolumeResult } from '@/engine/types';
import { useVolansStore } from '@/stores/useVolansStore';
import { searchMaxSkyVolume } from '@/engine/sky-factor/optimize';
import { optimizeInWorker } from '@/engine/sky-factor/worker-client';

export interface SkyOptimizationState {
  running: boolean;
  error: string | null;
  progress: { iter: number; lo: number; hi: number } | null;
  lastElapsedMs: number | null;
}

export function useSkyOptimization(volumeResult: VolumeResult | null) {
  const [state, setState] = useState<SkyOptimizationState>({
    running: false,
    error: null,
    progress: null,
    lastElapsedMs: null,
  });

  const run = useCallback(async () => {
    if (!volumeResult || volumeResult.envelopeIndices.length === 0) {
      setState((s) => ({ ...s, error: 'envelope が未計算です' }));
      return;
    }
    const store = useVolansStore.getState();
    if (!store.site || store.roads.length === 0) {
      setState((s) => ({ ...s, error: '敷地または道路が未設定です' }));
      return;
    }
    setState({ running: true, error: null, progress: null, lastElapsedMs: null });

    try {
      const opts = {
        azSteps: 48,
        elSteps: 24,
        iterations: 8,
        maxPoints: 10,
        onProgress: (p: { iter: number; lo: number; hi: number }) =>
          setState((s) => ({ ...s, progress: p })),
      };
      const result =
        typeof window !== 'undefined' && typeof Worker !== 'undefined'
          ? await optimizeInWorker(store.site, store.roads, volumeResult, opts)
          : await searchMaxSkyVolume(store.site, store.roads, volumeResult, opts);
      useVolansStore.setState({
        skyMaxScale: result.maxScale,
        skyWorstMargin: result.worstMargin,
        skyOptimizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setState({
        running: false,
        error: null,
        progress: null,
        lastElapsedMs: result.elapsedMs,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '最適化に失敗しました';
      setState({ running: false, error: msg, progress: null, lastElapsedMs: null });
    }
  }, [volumeResult]);

  return { ...state, run };
}
