'use client';

import { useVolansStore } from '@/stores/useVolansStore';

/**
 * Small badge showing the provenance of the current site polygon. The
 * accuracy of every downstream calculation (volume, sky factor, etc.)
 * depends on the site shape being correct, so the user should always know
 * which data lineage is being used.
 */
export function SiteSourceBadge({ compact = false }: { compact?: boolean }) {
  const source = useVolansStore((s) => s.siteSource);

  const meta: Record<
    typeof source,
    { label: string; detail: string; color: string; bg: string; icon: string }
  > = {
    demo: {
      label: 'デモ',
      detail: '初期サンプル — 住所検索 or 描画で置き換えてください',
      color: 'var(--volans-muted)',
      bg: 'var(--volans-surface-alt)',
      icon: '🧪',
    },
    parcel: {
      label: '筆界データ',
      detail: '農研機構 AMX PMTiles 由来（実測地番）',
      color: 'var(--volans-success)',
      bg: 'var(--volans-success-soft)',
      icon: '✅',
    },
    manual: {
      label: '仮設定',
      detail: '地図上で手動描画 — 法的根拠なし、参考検討用',
      color: 'var(--volans-warning)',
      bg: 'var(--volans-warning-soft)',
      icon: '⚠️',
    },
    dxf: {
      label: 'DXF取込',
      detail: '設計図 (.dxf) 由来',
      color: 'var(--volans-primary)',
      bg: 'var(--volans-primary-soft)',
      icon: '📐',
    },
    ocr: {
      label: '図面OCR',
      detail: '測量図・概要書 OCR 由来',
      color: 'var(--volans-primary)',
      bg: 'var(--volans-primary-soft)',
      icon: '🔍',
    },
  };

  const m = meta[source];

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{ background: m.bg, color: m.color }}
        title={m.detail}
      >
        <span>{m.icon}</span>
        {m.label}
      </span>
    );
  }

  return (
    <div
      className="flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px]"
      style={{
        background: m.bg,
        border: `1px solid ${m.color}`,
      }}
    >
      <span className="text-[14px] leading-none">{m.icon}</span>
      <div className="flex flex-1 flex-col">
        <span className="font-semibold" style={{ color: m.color }}>
          データ出典: {m.label}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
          {m.detail}
        </span>
      </div>
    </div>
  );
}
