'use client';

import { FileDown, Share2 } from 'lucide-react';
import { MobileHeader } from '@/components/volans/MobileHeader';
import { PrintableReport } from '@/components/volans/PrintableReport';
import { useVolansResult } from '@/hooks/useVolansResult';
import { formatUpdatedAt } from '@/stores/useVolansStore';

const fmt = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt1 = (n: number) =>
  n.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function MobileReportPage() {
  const d = useVolansResult();

  function downloadPdf() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  async function share() {
    if (typeof window === 'undefined') return;
    const text = `${d.projectName}\n斜線案: ${fmt(d.slant.floorArea)}㎡ / 天空率案: ${fmt(d.sky.floorArea)}㎡ (+${fmt1(d.diff.pct)}%)`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'VOLANS 解析レポート', text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('概要をクリップボードにコピーしました');
    }
  }

  return (
    <>
      <MobileHeader back="/m" title="レポート出力 (PDF)" />
      <div className="flex flex-col gap-3 px-4 pt-3 pb-24">
        <div
          className="mx-auto w-full overflow-hidden rounded-xl p-4"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border)`,
            boxShadow: '0 8px 18px rgba(28,34,48,0.08)',
          }}
        >
          <div className="text-center">
            <div className="text-[14px] font-semibold" style={{ color: 'var(--volans-text)' }}>
              {d.projectName}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--volans-muted)' }}>
              解析レポート / 発行 {formatUpdatedAt(d.updatedAt)}
            </div>
          </div>

          <Section title="1. 計画概要">
            <Row label="所在地" value={d.address} />
            <Row label="敷地面積" value={`${fmt(d.siteArea)} ㎡`} />
            <Row label="用途地域" value={d.zoningName} />
            <Row
              label="建ぺい率/容積率"
              value={`${d.coverageRatioPct}% / ${d.floorAreaRatioPct}%`}
            />
            <Row label="前面道路" value={d.roadLabel} />
          </Section>

          <Section title="2. ボリューム比較">
            <div className="grid grid-cols-2 gap-2">
              <MiniBox color="slant" title="斜線案" value={d.slant.floorArea} floors={d.slant.floors} />
              <MiniBox color="sky" title="天空率案" value={d.sky.floorArea} floors={d.sky.floors} />
            </div>
            <div
              className="mt-2 rounded-md px-2 py-1.5 text-[10px] font-medium tabular-nums"
              style={{
                background: 'var(--volans-warning-soft)',
                color: 'var(--volans-warning)',
                border: `1px solid var(--volans-warning)`,
              }}
            >
              +{fmt(d.diff.floorArea)}㎡ (+{fmt1(d.diff.pct)}%)
            </div>
          </Section>

          <Section title="3. 天空率チェック">
            <Row label="天空率" value={d.skyCheck.value.toFixed(3)} />
            <Row label="基準率" value={d.skyCheck.baseline.toFixed(3)} />
            <Row
              label="参考"
              value={`+${d.skyCheck.margin.toFixed(3)} (+${d.skyCheck.marginPct.toFixed(1)}%)`}
              accent
            />
          </Section>
        </div>

        <button
          onClick={downloadPdf}
          className="flex items-center justify-center gap-2 rounded-md py-3 text-[13px] font-semibold text-white"
          style={{ background: 'var(--volans-primary)' }}
        >
          <FileDown className="h-4 w-4" />
          PDFをダウンロード
        </button>
        <button
          onClick={share}
          className="flex items-center justify-center gap-2 rounded-md py-3 text-[13px] font-medium"
          style={{
            background: 'var(--volans-surface)',
            border: `1px solid var(--volans-border-strong)`,
            color: 'var(--volans-text)',
          }}
        >
          <Share2 className="h-4 w-4" />
          共有する
        </button>
      </div>
      <PrintableReport />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        {title}
      </div>
      <div
        className="mt-1 rounded-md p-2 text-[10px]"
        style={{
          background: 'var(--volans-surface-alt)',
          border: `1px solid var(--volans-border)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span style={{ color: 'var(--volans-muted)' }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          color: accent ? 'var(--volans-success)' : 'var(--volans-text)',
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MiniBox({
  color,
  title,
  value,
  floors,
}: {
  color: 'slant' | 'sky';
  title: string;
  value: number;
  floors: number;
}) {
  const bg = color === 'slant' ? 'var(--volans-sky-slant-soft)' : 'var(--volans-sky-relax-soft)';
  return (
    <div
      className="rounded-md p-2 text-[10px]"
      style={{ background: bg, border: `1px solid var(--volans-border)` }}
    >
      <div style={{ color: 'var(--volans-muted)' }}>{title}</div>
      <div
        className="tabular-nums text-[13px] font-semibold"
        style={{ color: 'var(--volans-text)' }}
      >
        {fmt(value)}㎡
      </div>
      <div style={{ color: 'var(--volans-muted)' }}>{floors}階</div>
    </div>
  );
}
