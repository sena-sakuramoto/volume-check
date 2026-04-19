'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Pencil } from 'lucide-react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { StepIndicator } from '@/components/volans/StepIndicator';
import { SkyCheckPanel } from '@/components/volans/SkyCheckPanel';
import { QuickActions } from '@/components/volans/QuickActions';
import { useVolansResult } from '@/hooks/useVolansResult';
import { formatUpdatedAt } from '@/stores/useVolansStore';

type Tab = 'summary' | 'slant' | 'sky';

const fmt = (n: number) => n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) => n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function MobileDashboardPage() {
  const [tab, setTab] = useState<Tab>('summary');
  const d = useVolansResult();

  const primary = tab === 'slant' ? d.slant : d.sky;

  return (
    <>
      <MobileHeader />
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div
            className="text-[14px] font-semibold"
            style={{ color: 'var(--volans-text)' }}
          >
            {d.projectName}
          </div>
          <button
            aria-label="編集"
            className="grid h-5 w-5 place-items-center rounded"
            style={{ color: 'var(--volans-muted)' }}
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--volans-muted)' }}>
          最終更新 {formatUpdatedAt(d.updatedAt)}
        </div>
        <div className="mt-3">
          <StepIndicator activeId={3} compact />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div
              className="text-[12px] font-semibold"
              style={{ color: 'var(--volans-text)' }}
            >
              解析結果サマリー
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-lg p-0.5" style={{ background: 'var(--volans-surface-alt)' }}>
            {(['summary', 'slant', 'sky'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 rounded-md py-1.5 text-[11px] font-medium transition"
                style={{
                  background: tab === t ? 'var(--volans-surface)' : 'transparent',
                  color: tab === t ? 'var(--volans-primary)' : 'var(--volans-muted)',
                  boxShadow: tab === t ? '0 1px 3px rgba(28,34,48,0.06)' : 'none',
                }}
              >
                {t === 'summary' ? 'サマリー' : t === 'slant' ? '斜線案' : '天空率案'}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="text-[11px]" style={{ color: 'var(--volans-muted)' }}>
                延床面積 (最大)
              </div>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
                style={{
                  background: tab === 'slant' ? 'var(--volans-sky-slant)' : 'var(--volans-sky-relax)',
                }}
              >
                {tab === 'slant' ? '斜線案' : '天空率案'}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span
                className="text-[28px] font-semibold tabular-nums"
                style={{ color: 'var(--volans-text)' }}
              >
                {fmt(primary.floorArea)}
              </span>
              <span className="text-[12px]" style={{ color: 'var(--volans-muted)' }}>
                ㎡
              </span>
            </div>
            <div
              className="text-[12px] font-semibold tabular-nums"
              style={{ color: 'var(--volans-warning)' }}
            >
              +{fmt(d.diff.floorArea)} ㎡ (+{fmt1(d.diff.pct)}%)
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  建物階数 (最大)
                </div>
                <div className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--volans-text)' }}>
                  {primary.floors} 階
                </div>
                <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  斜線案: {d.slant.floors} 階
                </div>
              </div>
              <div>
                <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  容積充足率
                </div>
                <div className="text-[15px] font-semibold tabular-nums" style={{ color: 'var(--volans-text)' }}>
                  {fmt1(primary.farRatio)}%
                </div>
                <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                  斜線案: {fmt1(d.slant.farRatio)}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <SkyCheckPanel variant="mobile" />

        <div
          className="rounded-xl p-3"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          <div
            className="text-[12px] font-semibold"
            style={{ color: 'var(--volans-text)' }}
          >
            3Dビュー (天空率案)
          </div>
          <div
            className="mt-2 aspect-[5/3] w-full overflow-hidden rounded-lg"
            style={{
              background: 'linear-gradient(180deg, #eef2f9 0%, #dde4f0 100%)',
              border: `1px solid var(--volans-border)`,
            }}
          >
            <BuildingPreview />
          </div>
          <Link
            href="/m/3d"
            className="mt-3 flex items-center justify-center gap-1 rounded-md py-2 text-[12px] font-medium"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
          >
            3D表示を開く <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <QuickActions />
      </div>
    </>
  );
}

function BuildingPreview() {
  return (
    <svg viewBox="0 0 240 140" className="h-full w-full">
      <rect x={0} y={0} width={240} height={140} fill="transparent" />
      {[
        [20, 90, 26, 40],
        [48, 80, 22, 50],
        [180, 78, 20, 50],
        [210, 90, 18, 40],
      ].map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="#cfd6e2" opacity={0.75} />
      ))}
      <rect x={90} y={30} width={60} height={95} fill="#5d86d9" opacity={0.9} />
      <rect x={90} y={30} width={60} height={30} fill="#84adf0" opacity={0.9} />
      <polygon
        points="80,130 160,130 150,25 90,25"
        fill="none"
        stroke="#ef4444"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <polygon
        points="76,132 164,132 156,18 84,18"
        fill="none"
        stroke="#3eb883"
        strokeWidth={1}
        strokeDasharray="2 3"
      />
      <circle cx={210} cy={28} r={6} fill="#ffd87a" />
    </svg>
  );
}
