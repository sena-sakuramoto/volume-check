'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Sun, Layers as LayersIcon } from 'lucide-react';
import {
  Cube,
  Square as SquarePh,
  CircleDashed,
  ArrowsOut,
  Ruler,
} from '@phosphor-icons/react';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useVolansResult } from '@/hooks/useVolansResult';
import { useVolansStore } from '@/stores/useVolansStore';
import { HeaderBar } from '@/components/volans/HeaderBar';
import { LeftNav } from '@/components/volans/LeftNav';
import { SummaryCards } from '@/components/volans/SummaryCards';
import { ChecklistRow } from '@/components/volans/ChecklistRow';
import { SiteInfoCard } from '@/components/volans/SiteInfoCard';
import { SkyCheckPanel } from '@/components/volans/SkyCheckPanel';
import { QuickActions } from '@/components/volans/QuickActions';
import { LayerToggle } from '@/components/volans/LayerToggle';
import { FooterNote } from '@/components/volans/FooterNote';
import { PrintableReport } from '@/components/volans/PrintableReport';
import { ShareLinkLoader } from '@/components/volans/ShareLinkLoader';
import { useMultiTabSync } from '@/hooks/useMultiTabSync';
import { formatUpdatedAt } from '@/stores/useVolansStore';

function printPdf() {
  if (typeof window !== 'undefined') {
    window.print();
  }
}


function formatUpdatedAtForHeader(iso: string): string {
  return formatUpdatedAt(iso);
}

const Viewer = dynamic(
  () => import('@/components/three/Viewer').then((m) => ({ default: m.Viewer })),
  {
    ssr: false,
    loading: () => (
      <div
        className="grid h-full place-items-center text-[11px]"
        style={{ color: 'var(--volans-muted)' }}
      >
        3D ビューを読み込み中…
      </div>
    ),
  },
);

type RightTab = 'condition' | 'report';

export default function VolansSkyPage() {
  const [viewReady, setViewReady] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>('condition');
  useMultiTabSync();

  // Defer the 3D viewer mount to a microtask so we don't flash on hydration.
  useEffect(() => {
    queueMicrotask(() => setViewReady(true));
  }, []);

  // /sky is the ≥1024px layout per ui-spec-volans §7. Narrow viewports get
  // redirected to /m (mobile dashboard) to avoid the fixed-width panel
  // overflow. Uses matchMedia so the check re-runs on viewport emulation
  // changes (playwright, devtools rotate) — innerWidth alone was racing with
  // device emulation in e2e runs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => {
      if (mq.matches) window.location.replace('/m');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const storeSite = useVolansStore((s) => s.site);
  const storeRoads = useVolansStore((s) => s.roads);
  const storeZoning = useVolansStore((s) => s.zoning);
  const storeLatitude = useVolansStore((s) => s.latitude);
  const storeFloorHeights = useVolansStore((s) => s.floorHeights);
  const display = useVolansResult();

  const { volumeResult, effectiveFloorHeights } = useVolumeCalculation({
    site: storeSite,
    zoning: storeZoning,
    roads: storeRoads,
    latitude: storeLatitude,
    floorHeights: storeFloorHeights,
  });

  const site = storeSite;
  const roads = storeRoads;
  const zoning = storeZoning;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{
        background: 'var(--volans-bg)',
        color: 'var(--volans-text)',
        fontFamily: 'var(--font-body), "Noto Sans JP", sans-serif',
      }}
    >
      <HeaderBar
        activeStep={3}
        projectName={display.projectName}
        updatedAt={formatUpdatedAtForHeader(display.updatedAt)}
        onExportPdf={printPdf}
      />
      <PrintableReport />
      <ShareLinkLoader />

      <div className="flex flex-1 overflow-hidden">
        <LeftNav />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-1 min-h-0 gap-3 overflow-hidden p-3">
            {/* Center: 3D + summary + checklist */}
            <section className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              {/* 3D viewer card */}
              <div
                className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
                style={{
                  background: 'var(--volans-surface)',
                  border: `1px solid var(--volans-border)`,
                }}
              >
                {/* Top toolbar */}
                <div className="flex shrink-0 items-center justify-between px-3 py-2">
                  <button
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                    style={{
                      background: 'var(--volans-surface-alt)',
                      border: `1px solid var(--volans-border)`,
                      color: 'var(--volans-text)',
                    }}
                  >
                    <span>視点</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                      style={{
                        background: 'var(--volans-surface-alt)',
                        border: `1px solid var(--volans-border)`,
                        color: 'var(--volans-text)',
                      }}
                    >
                      <Sun className="h-3 w-3" style={{ color: 'var(--volans-warning)' }} />
                      日照時間 (冬至)
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
                      style={{
                        background: 'var(--volans-surface-alt)',
                        border: `1px solid var(--volans-border)`,
                        color: 'var(--volans-text)',
                      }}
                    >
                      <LayersIcon className="h-3 w-3" />
                      レイヤー
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* 3D canvas */}
                <div
                  className="relative min-h-0 flex-1"
                  style={{
                    background:
                      'linear-gradient(180deg, #f2f5fa 0%, #e6eaf3 100%)',
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

                  {/* minimap */}
                  <div
                    className="pointer-events-none absolute left-3 top-3 h-[72px] w-[96px] rounded-lg"
                    style={{
                      background: 'var(--volans-surface)',
                      border: `1px solid var(--volans-border)`,
                      boxShadow: '0 6px 14px rgba(28,34,48,0.08)',
                    }}
                  >
                    <svg viewBox="0 0 96 72" width={96} height={72}>
                      <rect x={0} y={0} width={96} height={72} fill="transparent" />
                      <polygon
                        points="22,20 72,16 78,52 18,54"
                        fill="var(--volans-primary-soft)"
                        stroke="var(--volans-primary)"
                        strokeWidth={1}
                      />
                      <text x={48} y={68} fontSize={7} textAnchor="middle" fill="var(--volans-muted)">
                        ミニマップ
                      </text>
                    </svg>
                  </div>

                  {/* legend */}
                  <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg bg-white/90 px-2 py-1.5 text-[10px] shadow-sm backdrop-blur"
                    style={{ border: `1px solid var(--volans-border)` }}
                  >
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--volans-text)' }}>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: 'var(--volans-sky-slant)' }}
                      />
                      斜線制限
                    </div>
                    <div className="flex items-center gap-1.5" style={{ color: 'var(--volans-text)' }}>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: 'var(--volans-sky-relax)' }}
                      />
                      天空率緩和後
                    </div>
                  </div>

                  {/* right toolbar */}
                  <div
                    className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg p-1"
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
                    ].map((b) => {
                      const Icon = b.icon;
                      return (
                        <button
                          key={b.label}
                          className="grid h-7 w-7 place-items-center rounded"
                          style={{
                            background: b.active ? 'var(--volans-primary-soft)' : 'transparent',
                            color: b.active ? 'var(--volans-primary-strong)' : 'var(--volans-muted)',
                          }}
                          aria-label={b.label}
                          title={b.label}
                        >
                          <Icon size={14} weight="regular" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <div
                  className="mb-2 px-1 text-[12px] font-semibold"
                  style={{ color: 'var(--volans-text)' }}
                >
                  解析結果サマリー
                </div>
                <SummaryCards slant={display.slant} sky={display.sky} diff={display.diff} />
              </div>

              <div className="shrink-0">
                <ChecklistRow checks={display.checks} />
              </div>
            </section>

            {/* Right panel */}
            <aside
              className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto"
            >
              <div
                className="flex shrink-0 items-center gap-1 rounded-xl p-1"
                style={{
                  background: 'var(--volans-surface)',
                  border: `1px solid var(--volans-border)`,
                }}
              >
                {(['condition', 'report'] as RightTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRightTab(t)}
                    className="flex-1 rounded-md py-1.5 text-[11px] font-medium transition"
                    style={{
                      background: rightTab === t ? 'var(--volans-primary-soft)' : 'transparent',
                      color:
                        rightTab === t
                          ? 'var(--volans-primary-strong)'
                          : 'var(--volans-muted)',
                    }}
                  >
                    {t === 'condition' ? '解析条件' : '解析レポート'}
                  </button>
                ))}
              </div>

              <SiteInfoCard
                address={display.address}
                area={display.siteArea}
                zoningName={display.zoningName}
                coverageRatioPct={display.coverageRatioPct}
                floorAreaRatioPct={display.floorAreaRatioPct}
                roadLabel={display.roadLabel}
              />
              <SkyCheckPanel variant="panel" />
              <LayerToggle />
              <QuickActions />
            </aside>
          </div>

          <FooterNote />
        </main>
      </div>
    </div>
  );
}
