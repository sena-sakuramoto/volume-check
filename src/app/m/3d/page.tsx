'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Share2, FileDown, Sun, Layers as LayersIcon, Send } from 'lucide-react';
import {
  Cube,
  Square as SquarePh,
  CircleDashed,
  ArrowsOut,
  Ruler,
} from '@phosphor-icons/react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { SkyCheckPanel } from '@/components/volans/SkyCheckPanel';
import { ViewerSkeleton } from '@/components/volans/ViewerSkeleton';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useVolansResult } from '@/hooks/useVolansResult';
import { useVolansStore } from '@/stores/useVolansStore';

const Viewer = dynamic(
  () => import('@/components/three/Viewer').then((m) => ({ default: m.Viewer })),
  {
    ssr: false,
    loading: () => <ViewerSkeleton />,
  },
);

export default function Mobile3DPage() {
  const [viewReady, setViewReady] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setViewReady(true));
  }, []);
  const site = useVolansStore((s) => s.site);
  const roads = useVolansStore((s) => s.roads);
  const zoning = useVolansStore((s) => s.zoning);
  const latitude = useVolansStore((s) => s.latitude);
  const floorHeightsStore = useVolansStore((s) => s.floorHeights);
  const floorHeights = useMemo(() => floorHeightsStore, [floorHeightsStore]);
  const { volumeResult, effectiveFloorHeights } = useVolumeCalculation({
    site,
    zoning,
    roads,
    latitude,
    floorHeights,
  });
  const display = useVolansResult();
  const { slant, sky, diff } = display;

  return (
    <>
      <MobileHeader back="/m" title="3Dビュア" subtitle="天空率案" />
      <div className="flex flex-col gap-3 px-4 pt-3">
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border)`,
            }}
          >
            <Sun className="h-3 w-3" style={{ color: 'var(--volans-warning)' }} />
            日照時間 (冬至)
            <ChevronDown className="h-3 w-3" />
          </button>
          <button
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border)`,
            }}
          >
            <LayersIcon className="h-3 w-3" />
            レイヤー
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <div
          className="relative aspect-[4/5] w-full overflow-hidden rounded-xl"
          style={{
            background: 'linear-gradient(180deg, #eef2f9 0%, #dde4f0 100%)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          {viewReady && (
            <Viewer
              site={site}
              roads={roads}
              zoning={zoning}
              volumeResult={volumeResult}
              floorHeights={effectiveFloorHeights}
              shadowTime={null}
              shadowMask={null}
              showVolansEnvelopes
              showVolansCity
            />
          )}
          <div
            className="absolute right-2 top-2 flex flex-col gap-1 rounded-md p-1"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border)`,
            }}
          >
            {[
              { icon: Cube, label: '3D', active: true },
              { icon: SquarePh, label: '2D' },
              { icon: CircleDashed, label: '断面' },
              { icon: ArrowsOut, label: '全画面' },
              { icon: Ruler, label: '測定' },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <button
                  key={i}
                  aria-label={b.label}
                  title={b.label}
                  className="grid h-6 w-6 place-items-center rounded"
                  style={{
                    background: b.active ? 'var(--volans-primary-soft)' : 'transparent',
                    color: b.active ? 'var(--volans-primary-strong)' : 'var(--volans-muted)',
                  }}
                >
                  <Icon size={12} weight="regular" />
                </button>
              );
            })}
          </div>
          <div
            className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-white/90 px-2 py-1 text-[10px] backdrop-blur"
            style={{ border: `1px solid var(--volans-border)` }}
          >
            <div className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: 'var(--volans-sky-slant)' }}
              />
              斜線案
            </div>
            <div className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: 'var(--volans-sky-relax)' }}
              />
              天空率緩和
            </div>
          </div>
        </div>

        <SkyCheckPanel variant="mobile" mobileButtonLabel="すべての測定点を確認" />

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
            ボリューム比較
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div
              className="rounded-lg p-2"
              style={{
                background: 'var(--volans-sky-slant-soft)',
                border: `1px solid var(--volans-border)`,
              }}
            >
              <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                斜線案
              </div>
              <div
                className="mt-0.5 text-[16px] font-semibold tabular-nums"
                style={{ color: 'var(--volans-text)' }}
              >
                {slant.floorArea.toLocaleString('ja-JP', { minimumFractionDigits: 2 })}㎡
              </div>
              <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                {slant.floors}階
              </div>
            </div>
            <div
              className="rounded-lg p-2"
              style={{
                background: 'var(--volans-sky-relax-soft)',
                border: `1px solid var(--volans-border)`,
              }}
            >
              <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
                天空率案
              </div>
              <div
                className="mt-0.5 text-[16px] font-semibold tabular-nums"
                style={{ color: 'var(--volans-text)' }}
              >
                {sky.floorArea.toLocaleString('ja-JP', { minimumFractionDigits: 2 })}㎡
              </div>
              <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
                {sky.floors}階
              </div>
            </div>
          </div>
          <div
            className="mt-2 rounded-lg p-2"
            style={{
              background: 'var(--volans-warning-soft)',
              border: `1px solid var(--volans-warning)`,
            }}
          >
            <div className="text-[9px]" style={{ color: 'var(--volans-muted)' }}>
              増加分 (天空率の効果)
            </div>
            <div
              className="flex items-baseline gap-1 text-[16px] font-semibold tabular-nums"
              style={{ color: 'var(--volans-warning)' }}
            >
              +{diff.floorArea.toLocaleString('ja-JP', { minimumFractionDigits: 2 })}㎡
              <span className="text-[12px]">(+{diff.pct}%)</span>
            </div>
            <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
              約{diff.floors}階分 (約{Math.round(diff.floorArea).toLocaleString()}㎡)
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="flex items-center justify-center gap-1 rounded-md py-2 text-[12px]"
              style={{
                background: 'var(--volans-surface)',
                border: `1px solid var(--volans-border-strong)`,
                color: 'var(--volans-text)',
              }}
            >
              <Share2 className="h-3.5 w-3.5" />
              シェア
            </button>
            <button
              className="flex items-center justify-center gap-1 rounded-md py-2 text-[12px] text-white"
              style={{ background: 'var(--volans-primary)' }}
            >
              <FileDown className="h-3.5 w-3.5" />
              PDF出力
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border)`,
          }}
        >
          <input
            className="flex-1 bg-transparent text-[12px] outline-none"
            style={{ color: 'var(--volans-text)' }}
            placeholder="メッセージを入力…"
          />
          <button
            className="grid h-8 w-8 place-items-center rounded-full text-white"
            style={{ background: 'var(--volans-primary)' }}
            aria-label="送信"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
