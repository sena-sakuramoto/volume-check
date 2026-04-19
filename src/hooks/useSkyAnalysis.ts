'use client';

import { useCallback, useState } from 'react';
import type { VolumeResult } from '@/engine/types';
import { useVolansStore } from '@/stores/useVolansStore';
import { analyzeSkyFactor, type SkyFactorAnalysis } from '@/engine/sky-factor/analyze';
import { analyzeInWorker } from '@/engine/sky-factor/worker-client';

export interface SkyAnalysisState {
  analysis: SkyFactorAnalysis | null;
  running: boolean;
  error: string | null;
  elapsedMs: number | null;
}

/**
 * On-demand sky factor analysis. Runs in a Web Worker so the main thread
 * stays responsive; falls back to synchronous execution when worker isn't
 * supported (SSR / older runtimes).
 */
export function useSkyAnalysis(volumeResult: VolumeResult | null) {
  const [state, setState] = useState<SkyAnalysisState>({
    analysis: null,
    running: false,
    error: null,
    elapsedMs: null,
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

    setState({ analysis: null, running: true, error: null, elapsedMs: null });
    await new Promise((r) => setTimeout(r, 0));
    const start = performance.now();
    try {
      const opts = { azSteps: 96, elSteps: 48, maxPoints: 16 };
      const analysis =
        typeof window !== 'undefined' && typeof Worker !== 'undefined'
          ? await analyzeInWorker(store.site, store.roads, volumeResult, volumeResult, opts)
          : analyzeSkyFactor(store.site, store.roads, volumeResult, volumeResult, opts);
      const elapsed = performance.now() - start;
      setState({ analysis, running: false, error: null, elapsedMs: elapsed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析に失敗しました';
      setState({ analysis: null, running: false, error: msg, elapsedMs: null });
    }
  }, [volumeResult]);

  return { ...state, run };
}
