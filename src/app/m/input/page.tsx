'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronRight, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { SitePreview } from '@/components/volans/SitePreview';
import { SiteEditor } from '@/components/volans/SiteEditor';
import { RoadEditor } from '@/components/volans/RoadEditor';
import { DxfBoundaryPicker } from '@/components/volans/DxfBoundaryPicker';
import { OcrBoundaryPicker } from '@/components/volans/OcrBoundaryPicker';
import { VolansMap } from '@/components/volans/VolansMap';
import {
  AnalysisProgressOverlay,
  type ProgressStep,
} from '@/components/volans/AnalysisProgressOverlay';
import { useVolansStore } from '@/stores/useVolansStore';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useSkyAnalysis } from '@/hooks/useSkyAnalysis';
import { useSkyOptimization } from '@/hooks/useSkyOptimization';
import { hapticConfirm } from '@/lib/haptic';

const DISTRICT_LABELS: Record<string, string> = {
  第一種低層住居専用地域: '第一種低層住居',
  第二種低層住居専用地域: '第二種低層住居',
  第一種中高層住居専用地域: '第一種中高層',
  第二種中高層住居専用地域: '第二種中高層',
  第一種住居地域: '第一種住居地域',
  第二種住居地域: '第二種住居地域',
  準住居地域: '準住居地域',
  田園住居地域: '田園住居地域',
  近隣商業地域: '近隣商業地域',
  商業地域: '商業地域',
  準工業地域: '準工業地域',
  工業地域: '工業地域',
  工業専用地域: '工業専用地域',
};

export default function MobileInputPage() {
  const router = useRouter();
  const store = useVolansStore();
  const [localAddress, setLocalAddress] = useState(store.address);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const progressLabel = useVolansStore((s) => s.progressLabel);

  // Analysis pipeline state
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const { volumeResult } = useVolumeCalculation({
    site: store.site,
    zoning: store.zoning,
    roads: store.roads,
    latitude: store.latitude,
    floorHeights: store.floorHeights,
  });
  const skyAnalysis = useSkyAnalysis(volumeResult);
  const skyOpt = useSkyOptimization(volumeResult);

  async function onSearch() {
    if (!localAddress.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await useVolansStore.getState().fetchFromAddress(localAddress.trim());
    setBusy(false);
    if (result.ok) {
      const state = useVolansStore.getState();
      const hasParcels = state.parcelCandidates.length > 0;
      setMessage({
        kind: 'ok',
        text: hasParcels
          ? `敷地候補 ${state.parcelCandidates.length} 件 + 法規情報を取得`
          : '法規情報を取得（敷地形状は手動設定のまま）',
      });
    } else {
      setMessage({ kind: 'err', text: result.message ?? '取得に失敗しました' });
    }
  }

  async function onRun() {
    hapticConfirm();
    setProgressError(null);
    setProgressOpen(true);

    const mkSteps = (update: Partial<Record<string, ProgressStep['state']>> = {}): ProgressStep[] => {
      const base: Array<Omit<ProgressStep, 'state'> & { initial: ProgressStep['state'] }> = [
        { key: 'site',     label: '敷地形状を確定',         initial: 'pending' },
        { key: 'volume',   label: '容積率・斜線制限を計算', initial: 'pending' },
        { key: 'sky',      label: '天空率チェックを評価',   initial: 'pending' },
        { key: 'optimize', label: '天空率でボリューム最大化', initial: 'pending' },
        { key: 'done',     label: '結果を生成',             initial: 'pending' },
      ];
      return base.map((s) => ({
        key: s.key,
        label: s.label,
        state: (update[s.key] ?? s.initial) as ProgressStep['state'],
      }));
    };

    const running = (current: string, done: string[] = []) => {
      const upd: Partial<Record<string, ProgressStep['state']>> = {};
      done.forEach((k) => (upd[k] = 'done'));
      upd[current] = 'running';
      setProgressSteps(mkSteps(upd));
    };

    try {
      running('site');
      await new Promise((r) => setTimeout(r, 250));

      running('volume', ['site']);
      // volumeResult is already computed reactively above; just show progress.
      await new Promise((r) => setTimeout(r, 250));
      if (!volumeResult) {
        throw new Error('ボリューム計算に失敗しました');
      }

      running('sky', ['site', 'volume']);
      await skyAnalysis.run();
      if (skyAnalysis.error) {
        throw new Error(skyAnalysis.error);
      }

      running('optimize', ['site', 'volume', 'sky']);
      await skyOpt.run();
      if (skyOpt.error) {
        // Optimization is best-effort; don't block the whole flow.
        // The existing demo fallback still gives the user a result.
      }

      running('done', ['site', 'volume', 'sky', 'optimize']);
      await useVolansStore.getState().runAnalysis();
      await new Promise((r) => setTimeout(r, 300));

      setProgressSteps(
        mkSteps({ site: 'done', volume: 'done', sky: 'done', optimize: 'done', done: 'done' }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析に失敗しました';
      setProgressError(msg);
      setProgressSteps((curr) =>
        curr.map((s) => (s.state === 'running' ? { ...s, state: 'error' } : s)),
      );
    }
  }

  function onProgressDismiss() {
    const ok = progressSteps.length > 0 && progressSteps.every((s) => s.state === 'done');
    setProgressOpen(false);
    if (ok) router.push('/m');
  }

  const coveragePct = Math.round(store.zoning.coverageRatio * 100);
  const farPct = Math.round(store.zoning.floorAreaRatio * 100);

  const conditions: { k: string; v: string; chevron?: boolean }[] = [
    { k: '検討パターン', v: '標準パターン', chevron: true },
    {
      k: '最大階数 (上限)',
      v: `${store.floorHeights.length}階`,
      chevron: true,
    },
    { k: '地盤面の高さ (GL)', v: '±0.00 m', chevron: true },
  ];

  return (
    <>
      <MobileHeader back="/m" title="敷地・法規の入力" />
      <div className="flex flex-col gap-4 px-4 pt-3 pb-24">
        <div className="flex items-center gap-1 text-[11px]">
          <span
            className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-white"
            style={{ background: 'var(--volans-primary)' }}
          >
            02
          </span>
          <span className="font-medium" style={{ color: 'var(--volans-text)' }}>
            敷地・法規・条件 → 解析・結果
          </span>
        </div>

        {progressLabel && (
          <div
            className="flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
            style={{
              background: 'var(--volans-primary-soft)',
              color: 'var(--volans-primary-strong)',
              border: `1px solid var(--volans-primary)`,
            }}
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{progressLabel}</span>
          </div>
        )}

        {message && (
          <div
            className="flex items-start gap-2 rounded-md px-3 py-2 text-[11px]"
            style={{
              background:
                message.kind === 'ok' ? 'var(--volans-success-soft)' : '#fdecec',
              color:
                message.kind === 'ok' ? 'var(--volans-success)' : 'var(--volans-danger)',
              border: `1px solid ${message.kind === 'ok' ? 'var(--volans-success)' : 'var(--volans-danger)'}`,
            }}
          >
            {message.kind === 'ok' ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <Section title="敷地情報">
          <div className="flex items-center gap-2">
            <input
              value={localAddress}
              onChange={(e) => setLocalAddress(e.target.value)}
              placeholder="住所を入力"
              className="flex-1 rounded-md bg-[var(--volans-surface-alt)] px-3 py-2 text-[12px] outline-none"
              style={{
                border: `1px solid var(--volans-border)`,
                color: 'var(--volans-text)',
              }}
            />
            <button
              onClick={onSearch}
              disabled={busy || !localAddress.trim()}
              className="flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-[11px] font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--volans-primary)' }}
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              検索
            </button>
          </div>

          <Row label="敷地面積" value={`${store.site.area.toLocaleString('ja-JP', { minimumFractionDigits: 2 })} ㎡`} />
          <Row
            label="形状タイプ"
            value={`多角形 (${store.site.vertices.length}点)`}
            chevron
          />

          {store.lat !== null && store.lng !== null && (
            <div
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[10px]"
              style={{ color: 'var(--volans-muted)' }}
            >
              <span>座標</span>
              <span className="tabular-nums">
                {store.lat.toFixed(5)}, {store.lng.toFixed(5)}
              </span>
            </div>
          )}

          <div className="mt-1">
            <div
              className="mb-1.5 text-[10px] font-semibold"
              style={{ color: 'var(--volans-muted)' }}
            >
              地図（筆界をタップで選択）
            </div>
            <VolansMap height={200} />
          </div>

          <div className="mt-1">
            <div
              className="mb-1.5 text-[10px] font-semibold"
              style={{ color: 'var(--volans-muted)' }}
            >
              敷地図プレビュー（選択された敷地）
            </div>
            <SitePreview site={store.site} />
          </div>

          {store.parcelCandidates.length === 0 && store.lat !== null && store.lng !== null && (
            <div
              className="mt-2 rounded-md p-2.5 text-[11px]"
              style={{
                background: 'var(--volans-warning-soft)',
                border: `1px solid var(--volans-warning)`,
              }}
            >
              <div className="font-medium" style={{ color: 'var(--volans-warning)' }}>
                この地点の筆界データが取得できませんでした
              </div>
              <div className="mt-0.5" style={{ color: 'var(--volans-muted)' }}>
                下の「敷地形状を編集」で手動調整するか、CAD (DXF) / 測量図画像を取り込めます。
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {[
                  { w: 10, h: 15, label: '10×15m (150㎡)' },
                  { w: 15, h: 20, label: '15×20m (300㎡)' },
                  { w: 20, h: 25, label: '20×25m (500㎡)' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      useVolansStore.getState().setSiteFromCad(
                        [
                          { x: 0, y: 0 },
                          { x: preset.w, y: 0 },
                          { x: preset.w, y: preset.h },
                          { x: 0, y: preset.h },
                        ],
                        { roadEdgeIndices: [[0, 1]], roadWidthDefault: 6 },
                      );
                    }}
                    className="rounded px-1 py-1 text-[10px] font-medium transition-colors hover:brightness-95"
                    style={{
                      background: 'var(--volans-surface)',
                      border: `1px solid var(--volans-border-strong)`,
                      color: 'var(--volans-text)',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {store.parcelCandidates.length > 1 && (
            <div className="mt-2">
              <div
                className="mb-1 text-[10px] font-semibold"
                style={{ color: 'var(--volans-muted)' }}
              >
                候補 ({store.parcelCandidates.length})
              </div>
              <div className="flex flex-col gap-1">
                {store.parcelCandidates.slice(0, 6).map((p, i) => {
                  const active = i === store.selectedParcelIndex;
                  return (
                    <button
                      key={`${p.chiban}-${i}`}
                      onClick={() => useVolansStore.getState().selectParcel(i)}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
                      style={{
                        background: active
                          ? 'var(--volans-primary-soft)'
                          : 'var(--volans-surface-alt)',
                        border: `1px solid ${active ? 'var(--volans-primary)' : 'var(--volans-border)'}`,
                        color: 'var(--volans-text)',
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            background: active
                              ? 'var(--volans-primary)'
                              : 'var(--volans-border-strong)',
                          }}
                        />
                        地番 {p.chiban}
                      </span>
                      <span
                        className="tabular-nums text-[10px]"
                        style={{ color: 'var(--volans-muted)' }}
                      >
                        {p.containsPoint
                          ? '（地点上）'
                          : p.distanceMeters !== null
                            ? `${p.distanceMeters.toFixed(1)}m`
                            : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <SiteEditor />
        <RoadEditor />
        <DxfBoundaryPicker />
        <OcrBoundaryPicker />

        <Section title="法規・条件 (自動取得)">
          <Row label="用途地域" value={DISTRICT_LABELS[store.zoning.district] ?? store.zoning.district} />
          <Row label="建ぺい率" value={`${coveragePct}%`} />
          <Row label="容積率" value={`${farPct}%`} />
          <Row label="高度地区" value={store.zoning.heightDistrict.type} />
          <Row label="防火地域" value={store.zoning.fireDistrict} />
          <Row
            label="前面道路幅員"
            value={
              store.roads[0]
                ? `${store.roads[0].width.toFixed(1)}m`
                : '—'
            }
          />
          <button
            className="mt-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px]"
            style={{ color: 'var(--volans-primary)' }}
          >
            すべての条件を確認
            <ChevronRight className="h-3 w-3" />
          </button>
        </Section>

        <Section title="検討条件">
          {conditions.map((c) => (
            <Row key={c.k} label={c.k} value={c.v} chevron={c.chevron} />
          ))}
        </Section>

        <button
          onClick={onRun}
          disabled={busy || progressOpen}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{
            background: 'var(--volans-primary)',
            boxShadow: '0 8px 18px rgba(59,109,225,0.3)',
          }}
        >
          {(busy || progressOpen) && <Loader2 className="h-4 w-4 animate-spin" />}
          {progressOpen ? '解析中…' : '解析を実行'}
        </button>
        <div className="text-center text-[10px]" style={{ color: 'var(--volans-muted)' }}>
          容積・斜線・天空率を順に計算します（数秒〜数十秒）
        </div>
      </div>

      <AnalysisProgressOverlay
        open={progressOpen}
        steps={progressSteps}
        error={progressError}
        onDismiss={onProgressDismiss}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        {title}
      </div>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  chevron,
}: {
  label: string;
  value: string;
  chevron?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px]"
      style={{ background: 'var(--volans-surface-alt)' }}
    >
      <span className="shrink-0" style={{ color: 'var(--volans-muted)' }}>
        {label}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-1">
        <span className="truncate tabular-nums" style={{ color: 'var(--volans-text)' }}>
          {value}
        </span>
        {chevron && (
          <ChevronRight
            className="h-3 w-3 shrink-0"
            style={{ color: 'var(--volans-muted)' }}
          />
        )}
      </div>
    </div>
  );
}
