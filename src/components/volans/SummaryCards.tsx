'use client';

import Link from 'next/link';
import { VOLANS_DEMO } from '@/lib/volans-demo';
import { useSkyOptimization } from '@/hooks/useSkyOptimization';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useVolansStore } from '@/stores/useVolansStore';
import { Loader2, Sparkles } from 'lucide-react';

type Tone = 'slant' | 'sky' | 'diff';

interface SummaryProps {
  slant?: { floorArea: number; floors: number; coverage: number; farRatio: number };
  sky?: { floorArea: number; floors: number; coverage: number; farRatio: number };
  diff?: { floorArea: number; floors: number; pct: number };
}

const toneStyle: Record<Tone, { bg: string; pill: string; pillText: string; border: string; accent: string }> = {
  slant: {
    bg: 'var(--volans-sky-slant-soft)',
    pill: 'var(--volans-sky-slant)',
    pillText: '#ffffff',
    border: 'var(--volans-border)',
    accent: 'var(--volans-sky-slant)',
  },
  sky: {
    bg: 'var(--volans-sky-relax-soft)',
    pill: 'var(--volans-sky-relax)',
    pillText: '#ffffff',
    border: 'var(--volans-border)',
    accent: 'var(--volans-sky-relax)',
  },
  diff: {
    bg: 'var(--volans-warning-soft)',
    pill: 'var(--volans-warning)',
    pillText: '#ffffff',
    border: 'var(--volans-border)',
    accent: 'var(--volans-warning)',
  },
};

function Card({
  tone,
  pillText,
  heading,
  value,
  valueLabel,
  metrics,
  cta,
  href,
}: {
  tone: Tone;
  pillText: string;
  heading: string;
  value: string;
  valueLabel: string;
  metrics: { label: string; value: string }[];
  cta: string;
  href: string;
}) {
  const s = toneStyle[tone];
  return (
    <div
      className="flex flex-col rounded-xl p-4"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ background: s.pill, color: s.pillText }}
        >
          {pillText}
        </span>
      </div>
      <div className="mt-2 text-[11px]" style={{ color: 'var(--volans-muted)' }}>
        {heading}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className="text-[28px] font-semibold tabular-nums leading-none"
          style={{ color: 'var(--volans-text)' }}
        >
          {value}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--volans-muted)' }}>
          {valueLabel}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        {metrics.map((m, i) => (
          <div key={`${m.label}-${i}`}>
            <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
              {m.label}
            </div>
            <div
              className="tabular-nums font-medium"
              style={{ color: 'var(--volans-text)' }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className="mt-3 rounded-md py-1.5 text-center text-[11px] font-medium transition hover:brightness-95"
        style={{
          background: 'var(--volans-surface)',
          border: `1px solid ${s.border}`,
          color: 'var(--volans-text)',
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) => n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function SummaryCards({ slant, sky, diff }: SummaryProps = {}) {
  const s = slant ?? VOLANS_DEMO.summary.slant;
  const sk = sky ?? VOLANS_DEMO.summary.sky;
  const d = diff ?? VOLANS_DEMO.summary.diff;

  const site = useVolansStore((st) => st.site);
  const roads = useVolansStore((st) => st.roads);
  const zoning = useVolansStore((st) => st.zoning);
  const latitude = useVolansStore((st) => st.latitude);
  const floorHeights = useVolansStore((st) => st.floorHeights);
  const maxScale = useVolansStore((st) => st.skyMaxScale);
  const { volumeResult } = useVolumeCalculation({
    site,
    zoning,
    roads,
    latitude,
    floorHeights,
  });
  const { running, run, lastElapsedMs, progress, error } = useSkyOptimization(volumeResult);

  return (
    <div className="flex flex-col gap-2"><div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--volans-muted)' }}>
        <Sparkles className="h-3 w-3" />
        {maxScale !== null
          ? `天空率 最適化済み（k=${maxScale.toFixed(3)}${lastElapsedMs !== null ? ` / ${(lastElapsedMs / 1000).toFixed(1)}秒` : ''}）`
          : '天空率 最大化は未実行（サマリは推定値）'}
      </div>
      <button
        onClick={run}
        disabled={running || !volumeResult}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--volans-sky-relax)' }}
      >
        {running ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {progress ? `iter ${progress.iter}` : '計算中…'}
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            {maxScale !== null ? '天空率 再最適化' : '天空率 最大化を実行'}
          </>
        )}
      </button>
    </div>
    {error && (
      <div
        className="mx-1 rounded-md px-2 py-1 text-[10px]"
        style={{
          background: '#fdecec',
          color: 'var(--volans-danger)',
        }}
      >
        {error}
      </div>
    )}
    <div className="grid grid-cols-3 gap-3">
      <Card
        tone="slant"
        pillText="斜線制限のみ (現行)"
        heading="延床面積 (最大)"
        value={fmt(s.floorArea)}
        valueLabel="㎡"
        metrics={[
          { label: '建物階数', value: `${s.floors} 階` },
          { label: '建ぺい率', value: `${fmt1(s.coverage)}%` },
          { label: '容積充足率', value: `${fmt1(s.farRatio)}%` },
        ]}
        cta="詳細を見る"
        href="/m/compare"
      />
      <Card
        tone="sky"
        pillText="天空率緩和を活用"
        heading="延床面積 (最大)"
        value={fmt(sk.floorArea)}
        valueLabel="㎡"
        metrics={[
          { label: '建物階数', value: `${sk.floors} 階` },
          { label: '建ぺい率', value: `${fmt1(sk.coverage)}%` },
          { label: '容積充足率', value: `${fmt1(sk.farRatio)}%` },
        ]}
        cta="詳細を見る"
        href="/m/compare"
      />
      <Card
        tone="diff"
        pillText="増加分 (天空率の効果)"
        heading="延床面積の増加"
        value={`+${fmt(d.floorArea)}`}
        valueLabel="㎡"
        metrics={[
          { label: '増加階数', value: `+${d.floors} 階` },
          { label: '増加率', value: `+${fmt1(d.pct)}%` },
          { label: '', value: '' },
        ]}
        cta="パターン比較を見る"
        href="/m/compare"
      />
    </div>
    </div>
  );
}
