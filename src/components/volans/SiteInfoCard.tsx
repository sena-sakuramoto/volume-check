import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { VOLANS_DEMO } from '@/lib/volans-demo';

interface SiteInfoProps {
  address?: string;
  area?: number;
  zoningName?: string;
  coverageRatioPct?: number;
  floorAreaRatioPct?: number;
  roadLabel?: string;
}

export function SiteInfoCard({
  address,
  area,
  zoningName,
  coverageRatioPct,
  floorAreaRatioPct,
  roadLabel,
}: SiteInfoProps = {}) {
  const demo = VOLANS_DEMO.site;
  const rows: { label: string; value: string }[] = [
    { label: '所在地', value: address ?? demo.address },
    {
      label: '敷地面積',
      value: `${(area ?? demo.area).toLocaleString('ja-JP', { minimumFractionDigits: 2 })} ㎡`,
    },
    { label: '用途地域', value: zoningName ?? demo.zoningName },
    {
      label: '建ぺい率/容積率',
      value: `${coverageRatioPct ?? demo.coverageRatio}% / ${floorAreaRatioPct ?? demo.floorAreaRatio}%`,
    },
    { label: '前面道路', value: roadLabel ?? `${demo.road.side} ${demo.road.kind} ${demo.road.width.toFixed(1)}m` },
  ];
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
          敷地情報
        </div>
        <Link
          href="/m/input"
          className="rounded-md px-1.5 py-0.5 text-[11px] transition-colors hover:bg-[var(--volans-primary-soft)]"
          style={{ color: 'var(--volans-primary)' }}
        >
          編集
        </Link>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 text-[11px]">
            <span style={{ color: 'var(--volans-muted)' }}>{r.label}</span>
            <span
              className="text-right tabular-nums"
              style={{ color: 'var(--volans-text)' }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/m/input"
        className="group mt-3 flex items-center gap-0.5 text-[11px] transition-colors hover:text-[var(--volans-primary-strong)]"
        style={{ color: 'var(--volans-primary)' }}
      >
        敷地・法規データを確認
        <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
