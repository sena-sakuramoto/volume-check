'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  FileText,
  Play,
  Menu,
  MousePointer2,
  Circle,
  Move,
  ZoomIn,
  ZoomOut,
  Home,
  ChevronDown,
  CheckCircle2,
  Settings2,
  Layers,
  BarChart3,
  Building2,
  GitCompare,
  FileEdit,
  FileImage,
  Info,
  ClipboardList,
  Sun,
} from 'lucide-react';
import { DEMO_SITE, DEMO_ROADS, DEMO_ZONING } from '@/lib/demo-data';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';

const Viewer = dynamic(
  () => import('@/components/three/Viewer').then((m) => ({ default: m.Viewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-50 text-xs text-slate-400">
        3D ビューを読み込み中…
      </div>
    ),
  },
);

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  heading: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'モデル・入力',
    items: [
      { id: 'basic', label: '基本情報', icon: Info },
      { id: 'site', label: '敷地・建物設定', icon: Building2 },
      { id: 'slant', label: '斜線条件', icon: Sun },
      { id: 'calc', label: '計算条件', icon: Settings2 },
    ],
  },
  {
    heading: '計算・結果',
    items: [
      { id: 'sky', label: '天空率計算', icon: BarChart3 },
      { id: 'result', label: '結果確認', icon: ClipboardList },
      { id: 'volume', label: 'ボリューム確認', icon: Layers },
      { id: 'compare', label: '比較検討', icon: GitCompare },
    ],
  },
  {
    heading: '出力',
    items: [
      { id: 'doc', label: '計算書作成', icon: FileEdit },
      { id: 'drawing', label: '図面出力', icon: FileImage },
    ],
  },
];

const TABS = ['3Dビュー', '平面図', '断面図（X方向）', '断面図（Y方向）'] as const;

type TabId = (typeof TABS)[number];

type SlantCondition = {
  type: string;
  range: string;
  slope: string;
  relax: string;
  ok: boolean;
};

const SLANT_CONDITIONS: SlantCondition[] = [
  { type: '道路斜線', range: '前面道路（幅員16.0m）', slope: '1.25', relax: '適用なし', ok: true },
  { type: '隣地斜線（東側）', range: '隣地境界から20m', slope: '1.25', relax: '適用なし', ok: true },
  { type: '隣地斜線（西側）', range: '隣地境界から20m', slope: '1.25', relax: '適用なし', ok: true },
  { type: '北側斜線', range: '敷地北側から10m', slope: '1.25', relax: '5m緩和', ok: true },
  { type: '絶対高さ制限', range: '—', slope: '—', relax: '31m', ok: true },
];

type SummaryRow = {
  point: string;
  sky: number;
  effective: number;
  ok: boolean;
};

const SUMMARY_ROWS: SummaryRow[] = [
  { point: '平均', sky: 0.82, effective: 0.86, ok: true },
  { point: '最低', sky: 0.63, effective: 0.68, ok: true },
  { point: '第1四分位', sky: 0.74, effective: 0.78, ok: true },
  { point: '中央値', sky: 0.85, effective: 0.89, ok: true },
  { point: '第3四分位', sky: 0.92, effective: 0.94, ok: true },
  { point: '最大', sky: 0.98, effective: 0.99, ok: true },
];

type MetricCard = {
  label: string;
  value: string;
  criterion: string;
  ok: boolean;
};

const METRIC_CARDS: MetricCard[] = [
  { label: '天空率（平均）', value: '0.82', criterion: '0.50以上', ok: true },
  { label: '天空率（最低）', value: '0.63', criterion: '0.50以上', ok: true },
  { label: '有効天空率（平均）', value: '0.86', criterion: '0.60以上', ok: true },
  { label: '有効天空率（最低）', value: '0.68', criterion: '0.60以上', ok: true },
];

function HeatmapLegend() {
  const bands = [
    { color: '#4a6fb8', label: '1.00 ～' },
    { color: '#84b3d9', label: '0.80 ～ 1.00' },
    { color: '#c4dbba', label: '0.60 ～ 0.80' },
    { color: '#f5e29a', label: '0.40 ～ 0.60' },
    { color: '#f2b378', label: '0.20 ～ 0.40' },
    { color: '#e2795a', label: '～ 0.20' },
  ];
  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-600">
      <div className="mb-1 font-medium text-slate-700">天空率</div>
      {bands.map((band) => (
        <div key={band.label} className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[2px]" style={{ background: band.color }} />
          <span>{band.label}</span>
        </div>
      ))}
      <div className="mt-1 text-[9px] text-slate-500">単位：-</div>
    </div>
  );
}

function HeatmapSVG() {
  // grid 8x6 mock
  const rows = 6;
  const cols = 8;
  const cellW = 36;
  const cellH = 32;
  const values: number[][] = [
    [0.45, 0.60, 0.70, 0.75, 0.80, 0.78, 0.70, 0.58],
    [0.55, 0.72, 0.85, 0.92, 0.95, 0.88, 0.75, 0.62],
    [0.62, 0.80, 0.98, 0.98, 0.98, 0.92, 0.80, 0.68],
    [0.60, 0.78, 0.95, 0.98, 0.98, 0.90, 0.78, 0.65],
    [0.52, 0.70, 0.85, 0.90, 0.92, 0.85, 0.72, 0.60],
    [0.42, 0.58, 0.70, 0.75, 0.78, 0.72, 0.62, 0.50],
  ];
  const colorFor = (v: number) => {
    if (v >= 1.0) return '#4a6fb8';
    if (v >= 0.8) return '#84b3d9';
    if (v >= 0.6) return '#c4dbba';
    if (v >= 0.4) return '#f5e29a';
    if (v >= 0.2) return '#f2b378';
    return '#e2795a';
  };
  return (
    <svg
      viewBox={`0 0 ${cols * cellW + 60} ${rows * cellH + 40}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <text x={8} y={18} className="fill-slate-500" fontSize={10}>
        N
      </text>
      <line x1={10} y1={22} x2={10} y2={36} stroke="#94a3b8" strokeWidth={1} />
      <polygon points="10,18 7,24 13,24" fill="#94a3b8" />
      <g transform={`translate(30, 20)`}>
        {values.map((row, i) =>
          row.map((v, j) => (
            <rect
              key={`${i}-${j}`}
              x={j * cellW}
              y={i * cellH}
              width={cellW - 1}
              height={cellH - 1}
              fill={colorFor(v)}
              rx={1}
            />
          )),
        )}
        {/* building outline */}
        <rect
          x={2 * cellW}
          y={1 * cellH}
          width={4 * cellW - 1}
          height={3 * cellH - 1}
          fill="white"
          stroke="#334155"
          strokeWidth={1}
        />
        <text
          x={2 * cellW + (4 * cellW) / 2}
          y={1 * cellH + (3 * cellH) / 2 + 3}
          textAnchor="middle"
          fontSize={10}
          className="fill-slate-600"
        >
          建築物
        </text>
      </g>
      {/* axis labels */}
      <text x={cols * cellW / 2 + 30} y={rows * cellH + 36} textAnchor="middle" fontSize={9} className="fill-slate-500">
        前面道路
      </text>
    </svg>
  );
}

export default function SkyFactorPage() {
  const [activeNav, setActiveNav] = useState('slant');
  const [activeTab, setActiveTab] = useState<TabId>('3Dビュー');
  const [slantVisible, setSlantVisible] = useState(true);
  const [viewReady, setViewReady] = useState(false);

  useEffect(() => {
    setViewReady(true);
  }, []);

  const site = DEMO_SITE;
  const roads = DEMO_ROADS;
  const zoning = DEMO_ZONING;
  const latitude = 35.68;
  const floorHeights = useMemo(() => [4.2, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6], []);

  const { volumeResult, effectiveFloorHeights } = useVolumeCalculation({
    site,
    zoning,
    roads,
    latitude,
    floorHeights,
  });

  const siteArea = site.area;
  const buildingArea = (siteArea * zoning.coverageRatio).toFixed(2);
  const totalFloor = volumeResult?.maxFloorArea
    ? volumeResult.maxFloorArea.toFixed(2)
    : (siteArea * zoning.floorAreaRatio).toFixed(2);
  const floorsCount = volumeResult?.maxFloors ?? floorHeights.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#fafbfc] text-slate-800">
      {/* Top header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-sky-500 to-sky-700 text-[11px] font-bold text-white">
              SF
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">SKY FACTOR</div>
              <div className="text-sm font-semibold text-slate-800">天空率計算</div>
            </div>
          </div>

          <div className="hidden items-center gap-8 text-xs lg:flex">
            <div>
              <div className="text-[10px] text-slate-500">プロジェクト</div>
              <button className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                サンプルプロジェクト_オフィスビル
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">計算種別</div>
              <button className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                天空率計算（道路斜線＋北側斜線）
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">バージョン</div>
              <div className="text-[13px] font-medium text-slate-800">v1.0.0</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <FileText className="h-3.5 w-3.5" />
            レポート出力
          </button>
          <button className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-700">
            <Play className="h-3.5 w-3.5 fill-white" />
            計算実行
          </button>
          <button className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <Menu className="h-3.5 w-3.5" />
            メニュー
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-[180px] shrink-0 flex-col border-r border-slate-200 bg-white py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="mb-3 px-3">
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.heading}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = activeNav === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveNav(item.id)}
                      className={[
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition',
                        active
                          ? 'bg-orange-50 font-semibold text-orange-700 shadow-[inset_2px_0_0_0_#ea8035]'
                          : 'text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <Icon className={['h-3.5 w-3.5', active ? 'text-orange-600' : 'text-slate-400'].join(' ')} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-auto border-t border-slate-200 px-3 pt-3">
            <button className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50">
              <Settings2 className="h-3.5 w-3.5 text-slate-400" />
              表示設定
            </button>
          </div>
        </aside>

        {/* Center */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Tabs */}
          <div className="flex h-10 items-end border-b border-slate-200 bg-white px-4">
            {TABS.map((tab) => {
              const active = tab === activeTab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'relative -mb-px px-4 py-2 text-[12px] transition',
                    active
                      ? 'border-b-2 border-sky-600 font-semibold text-sky-700'
                      : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Viewer toolbar */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3">
            <div className="flex items-center gap-1">
              {[
                { icon: MousePointer2, active: true },
                { icon: Circle, active: false },
                { icon: Move, active: false },
                { icon: ZoomIn, active: false },
                { icon: ZoomOut, active: false },
                { icon: Home, active: false },
              ].map((btn, i) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={i}
                    className={[
                      'grid h-7 w-7 place-items-center rounded transition',
                      btn.active
                        ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                        : 'text-slate-500 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <button className="flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                表示設定
                <ChevronDown className="h-3 w-3" />
              </button>
              <button className="flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                比較表示
                <ChevronDown className="h-3 w-3" />
              </button>
              <label className="flex cursor-pointer items-center gap-1.5 text-slate-600">
                <span>斜線</span>
                <span
                  role="switch"
                  aria-checked={slantVisible}
                  onClick={() => setSlantVisible(!slantVisible)}
                  className={[
                    'relative inline-block h-4 w-7 rounded-full transition',
                    slantVisible ? 'bg-orange-500' : 'bg-slate-300',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition',
                      slantVisible ? 'left-3.5' : 'left-0.5',
                    ].join(' ')}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* 3D canvas + bottom strip */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1 bg-gradient-to-b from-slate-50 to-slate-100">
              {activeTab === '3Dビュー' && viewReady ? (
                <Viewer
                  site={site}
                  roads={roads}
                  zoning={zoning}
                  volumeResult={volumeResult}
                  floorHeights={effectiveFloorHeights}
                  shadowTime={null}
                  shadowMask={null}
                />
              ) : (
                <div className="grid h-full place-items-center text-sm text-slate-400">
                  {activeTab}は準備中
                </div>
              )}

              {/* Legend overlay */}
              <div className="pointer-events-none absolute bottom-3 right-4 flex flex-col items-end gap-1 text-[10px] text-slate-600">
                <LegendRow color="#0ea5e9" label="道路斜線" />
                <LegendRow color="#22c55e" label="隣地斜線" />
                <LegendRow color="#8b5cf6" label="北側斜線" />
              </div>
            </div>

            {/* Model info strip */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-600">
              <span className="text-slate-500">モデル情報：</span>
              敷地面積 {siteArea.toFixed(2)}㎡ ｜ 建築面積 {buildingArea}㎡ ｜ 延床面積 {totalFloor}㎡ ｜ 階数 B1F〜{floorsCount}F
            </div>

            {/* Slant conditions table */}
            <div className="shrink-0 border-t border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <div className="text-[12px] font-semibold text-slate-700">斜線条件一覧</div>
                <button className="text-[11px] text-sky-600 hover:text-sky-700">編集</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2 font-medium">斜線種別</th>
                      <th className="px-4 py-2 font-medium">適用範囲</th>
                      <th className="px-4 py-2 font-medium">勾配</th>
                      <th className="px-4 py-2 font-medium">緩和</th>
                      <th className="px-4 py-2 font-medium">判定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SLANT_CONDITIONS.map((c) => (
                      <tr key={c.type} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 text-slate-700">{c.type}</td>
                        <td className="px-4 py-2 text-slate-600">{c.range}</td>
                        <td className="px-4 py-2 text-slate-600">{c.slope}</td>
                        <td className="px-4 py-2 text-slate-600">{c.relax}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            {c.ok ? 'OK' : 'NG'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>

        {/* Right panel */}
        <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="text-[12px] font-semibold text-slate-700">計算結果サマリー</div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {METRIC_CARDS.map((m) => (
              <div
                key={m.label}
                className="rounded-md border border-slate-200 bg-white p-3"
              >
                <div className="text-[10px] text-slate-500">{m.label}</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
                  {m.value}
                </div>
                <div className="mt-1 border-t border-slate-100 pt-1 text-[9px] text-slate-500">
                  基準：{m.criterion}
                </div>
                <div className="mt-0.5 text-[10px]">
                  判定：
                  <span className={m.ok ? 'font-semibold text-green-600' : 'font-semibold text-red-500'}>
                    {m.ok ? 'OK' : 'NG'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 px-4 py-3">
            <div className="text-[12px] font-semibold text-slate-700">天空率分布（平面図）</div>
          </div>
          <div className="px-3 pb-3">
            <div className="flex gap-2">
              <div className="flex-1 rounded-md border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-2">
                <div className="aspect-[4/3] w-full">
                  <HeatmapSVG />
                </div>
              </div>
              <div className="w-[72px] shrink-0 rounded-md border border-slate-200 bg-white p-2">
                <HeatmapLegend />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="text-[12px] font-semibold text-slate-700">天空率集計表</div>
            <button className="rounded border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50">
              詳細確認
            </button>
          </div>
          <div className="px-3 pb-3">
            <table className="min-w-full text-[11px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-2 py-1.5 font-medium">測定点</th>
                  <th className="px-2 py-1.5 font-medium">天空率</th>
                  <th className="px-2 py-1.5 font-medium">有効天空率</th>
                  <th className="px-2 py-1.5 font-medium">判定</th>
                </tr>
              </thead>
              <tbody>
                {SUMMARY_ROWS.map((r) => (
                  <tr key={r.point} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-1.5 text-slate-700">{r.point}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-800">{r.sky.toFixed(2)}</td>
                    <td className="px-2 py-1.5 tabular-nums text-slate-800">{r.effective.toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      <span className={r.ok ? 'text-green-600' : 'text-red-500'}>{r.ok ? 'OK' : 'NG'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[9px] text-slate-400">
              ※天空率は建築基準法施行令第135条の22に基づき算定しています。
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded bg-white/80 px-1.5 py-0.5 shadow-sm backdrop-blur-sm">
      <span className="inline-block h-0.5 w-4 rounded" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
