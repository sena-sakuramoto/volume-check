'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';
import { VOLANS_DEMO } from '@/lib/volans-demo';
import { HalfGauge } from './HalfGauge';
import { useVolansStore } from '@/stores/useVolansStore';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useSkyAnalysis } from '@/hooks/useSkyAnalysis';
import type { SkyFactorPointResult } from '@/engine/sky-factor/analyze';

interface SkyCheckPanelProps {
  variant?: 'panel' | 'mobile';
}

export function SkyCheckPanel({ variant = 'panel' }: SkyCheckPanelProps) {
  const site = useVolansStore((s) => s.site);
  const roads = useVolansStore((s) => s.roads);
  const zoning = useVolansStore((s) => s.zoning);
  const latitude = useVolansStore((s) => s.latitude);
  const floorHeights = useVolansStore((s) => s.floorHeights);
  const { volumeResult } = useVolumeCalculation({
    site,
    zoning,
    roads,
    latitude,
    floorHeights,
  });
  const { analysis, running, error, elapsedMs, run } = useSkyAnalysis(volumeResult);

  const [idx, setIdx] = useState(0);

  const pointResult: SkyFactorPointResult | null = useMemo(() => {
    if (!analysis || analysis.points.length === 0) return null;
    const i = Math.max(0, Math.min(idx, analysis.points.length - 1));
    return analysis.points[i];
  }, [analysis, idx]);

  // Fallback to demo while no analysis yet
  const demo = VOLANS_DEMO.skyCheck;
  const value = pointResult?.value ?? demo.value;
  const baseline = pointResult?.baseline ?? demo.baseline;
  const margin = pointResult?.margin ?? demo.margin;
  const marginPct = pointResult?.marginPct ?? demo.marginPct;
  const total = analysis?.points.length ?? demo.total;
  const displayIdx = (pointResult?.index ?? demo.index - 1) + 1;
  const typeLabel = pointResult?.label ?? demo.type;
  const pass = pointResult ? pointResult.pass : true;
  const isReal = analysis !== null;

  return (
    <div
      id="volans-sky-check"
      className="rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
          天空率チェック (代表点)
        </div>
        <button
          onClick={run}
          disabled={running || !volumeResult}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--volans-primary)' }}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isReal ? '再評価' : '天空率を評価'}
        </button>
      </div>

      {error && (
        <div
          className="mt-2 rounded-md px-2 py-1.5 text-[11px]"
          style={{
            background: '#fdecec',
            color: 'var(--volans-danger)',
            border: `1px solid var(--volans-danger)`,
          }}
        >
          {error}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span style={{ color: 'var(--volans-muted)' }}>測定点種類</span>
        <button
          className="flex items-center gap-1 rounded-md px-2 py-1"
          style={{
            background: 'var(--volans-surface-alt)',
            border: `1px solid var(--volans-border)`,
            color: 'var(--volans-text)',
          }}
        >
          {typeLabel}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span style={{ color: 'var(--volans-muted)' }}>測定点No.</span>
        <div
          className="flex items-center gap-1 rounded-md px-1 py-0.5"
          style={{
            background: 'var(--volans-surface-alt)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          <button
            className="grid h-5 w-5 place-items-center rounded"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            aria-label="前"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="tabular-nums" style={{ color: 'var(--volans-text)' }}>
            {displayIdx} / {total}
          </span>
          <button
            className="grid h-5 w-5 place-items-center rounded"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            aria-label="次"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="text-center">
          <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
            天空率
          </div>
          <div
            className="text-[20px] font-semibold tabular-nums leading-none"
            style={{ color: 'var(--volans-text)' }}
          >
            {value.toFixed(3)}
          </div>
        </div>
        <HalfGauge
          value={value}
          baseline={baseline}
          ok={pass}
          size={130}
          label={pass ? '適合' : '不適合'}
        />
        <div className="text-center">
          <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
            基準率
          </div>
          <div
            className="text-[20px] font-semibold tabular-nums leading-none"
            style={{ color: 'var(--volans-text)' }}
          >
            {baseline.toFixed(3)}
          </div>
        </div>
      </div>

      <div
        className="mt-1 text-center text-[11px] tabular-nums"
        style={{ color: pass ? 'var(--volans-success)' : 'var(--volans-danger)' }}
      >
        参考 {margin >= 0 ? '+' : ''}{margin.toFixed(3)} ({marginPct >= 0 ? '+' : ''}
        {marginPct.toFixed(1)}%)
      </div>

      {isReal && elapsedMs !== null && (
        <div
          className="mt-1 text-center text-[9px]"
          style={{ color: 'var(--volans-muted)' }}
        >
          実測値 — {(elapsedMs / 1000).toFixed(2)}秒で評価
        </div>
      )}
      {!isReal && !running && (
        <div
          className="mt-1 text-center text-[9px]"
          style={{ color: 'var(--volans-muted)' }}
        >
          サンプル値 — 「天空率を評価」で実測
        </div>
      )}

      {variant === 'panel' && (
        <button
          onClick={run}
          disabled={running || !volumeResult}
          className="mt-3 w-full rounded-md py-2 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--volans-primary)' }}
        >
          {running ? '評価中…' : isReal ? '全 ' + total + ' 点を再評価' : '天空率の詳細を表示'}
        </button>
      )}
      {variant === 'mobile' && (
        <button
          onClick={run}
          disabled={running || !volumeResult}
          className="mt-3 w-full rounded-md py-2 text-[12px] font-medium disabled:opacity-50"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
            color: 'var(--volans-text)',
          }}
        >
          {running ? '評価中…' : '詳細を確認する'}
        </button>
      )}
    </div>
  );
}
