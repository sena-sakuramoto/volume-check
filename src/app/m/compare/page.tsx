'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { useVolansResult } from '@/hooks/useVolansResult';

type Tab = 'list' | 'graph';

const fmt = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const toneColor = {
  slant: 'var(--volans-sky-slant)',
  sky: 'var(--volans-sky-relax)',
  neutral: 'var(--volans-muted)',
} as const;
const toneBg = {
  slant: 'var(--volans-sky-slant-soft)',
  sky: 'var(--volans-sky-relax-soft)',
  neutral: 'var(--volans-surface-alt)',
} as const;

export default function MobileComparePage() {
  const [tab, setTab] = useState<Tab>('list');
  const d = useVolansResult();

  // Build patterns from real engine output. Third pattern = midpoint scenario.
  const midFloorArea = (d.slant.floorArea + d.sky.floorArea) / 2;
  const midFloors = Math.round((d.slant.floors + d.sky.floors) / 2);
  const midFar = (d.slant.farRatio + d.sky.farRatio) / 2;

  const patterns = [
    {
      id: 'slant',
      name: '斜線案 (現行)',
      floorArea: d.slant.floorArea,
      floors: d.slant.floors,
      farRatio: d.slant.farRatio,
      tone: 'slant' as const,
    },
    {
      id: 'sky',
      name: '天空率案 (推奨)',
      floorArea: d.sky.floorArea,
      floors: d.sky.floors,
      farRatio: d.sky.farRatio,
      tone: 'sky' as const,
      recommended: true,
    },
    {
      id: 'mid',
      name: 'パターン C (中間)',
      floorArea: midFloorArea,
      floors: midFloors,
      farRatio: midFar,
      tone: 'neutral' as const,
    },
  ];

  // Simple graph data (relative bar heights normalized to sky case)
  const maxArea = Math.max(d.slant.floorArea, d.sky.floorArea, midFloorArea);

  return (
    <>
      <MobileHeader back="/m" title="パターン比較" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <div
          className="flex items-center gap-1 rounded-lg p-0.5"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          {(['list', 'graph'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-md py-1.5 text-[12px] font-medium transition"
              style={{
                background: tab === t ? 'var(--volans-primary-soft)' : 'transparent',
                color: tab === t ? 'var(--volans-primary-strong)' : 'var(--volans-muted)',
              }}
            >
              {t === 'list' ? '一覧' : 'グラフ'}
            </button>
          ))}
        </div>

        {tab === 'list' && (
          <div className="flex flex-col gap-2.5">
            {patterns.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl p-3"
                style={{
                  background: toneBg[p.tone],
                  border: `1px solid var(--volans-border)`,
                }}
              >
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: 'var(--volans-surface)',
                    border: `1px solid var(--volans-border)`,
                  }}
                >
                  <svg viewBox="0 0 36 36" width={32} height={32}>
                    <rect x={10} y={8} width={16} height={22} fill={toneColor[p.tone]} opacity={0.85} />
                    <rect x={10} y={8} width={16} height={7} fill={toneColor[p.tone]} opacity={0.5} />
                  </svg>
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: 'var(--volans-text)' }}
                    >
                      {p.name}
                    </span>
                    {'recommended' in p && p.recommended && (
                      <span
                        className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                        style={{ background: 'var(--volans-sky-relax)' }}
                      >
                        推奨
                      </span>
                    )}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
                    <div>
                      <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                        延床面積
                      </div>
                      <div className="tabular-nums font-medium" style={{ color: 'var(--volans-text)' }}>
                        {fmt(p.floorArea)}㎡
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                        階数
                      </div>
                      <div className="tabular-nums font-medium" style={{ color: 'var(--volans-text)' }}>
                        {p.floors}階
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                        充足率
                      </div>
                      <div className="tabular-nums font-medium" style={{ color: 'var(--volans-text)' }}>
                        {fmt1(p.farRatio)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'graph' && (
          <div
            className="rounded-xl p-3"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border)`,
            }}
          >
            <div className="flex h-[160px] items-end gap-3">
              {patterns.map((p) => {
                const h = maxArea > 0 ? (p.floorArea / maxArea) * 100 : 0;
                return (
                  <div key={p.id} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${h}%`,
                        background: toneColor[p.tone],
                        opacity: 0.85,
                      }}
                    />
                    <div
                      className="text-[9px] tabular-nums"
                      style={{ color: 'var(--volans-text)' }}
                    >
                      {fmt(p.floorArea)}
                    </div>
                    <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                      {p.name.replace(/\s*\(.*\)/, '')}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-center text-[9px]" style={{ color: 'var(--volans-muted)' }}>
              延床面積 (㎡)
            </div>
          </div>
        )}

        <button
          className="mt-1 flex items-center justify-center gap-1 rounded-md py-2 text-[12px] font-medium"
          style={{
            background: 'var(--volans-surface)',
            border: `1px dashed var(--volans-border-strong)`,
            color: 'var(--volans-primary)',
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          新しいパターンを追加
        </button>
      </div>
    </>
  );
}
