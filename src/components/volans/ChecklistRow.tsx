import Link from 'next/link';
import { CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { VOLANS_DEMO } from '@/lib/volans-demo';

interface ChecklistRowProps {
  checks?: Array<{ label: string; ok: boolean; note?: string }>;
}

export function ChecklistRow({ checks }: ChecklistRowProps = {}) {
  const items = checks ?? VOLANS_DEMO.checks;
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[11px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        主要チェック結果
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1.5">
        {items.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
            <span style={{ color: 'var(--volans-muted)' }}>{c.label}</span>
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: c.ok ? 'var(--volans-success-soft)' : '#fdecec',
                color: c.ok ? 'var(--volans-success)' : 'var(--volans-danger)',
              }}
            >
              {c.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {c.ok ? '適合' : '不適合'}
              {c.note && <span className="ml-0.5">{c.note}</span>}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/m/compare"
        className="flex shrink-0 items-center gap-0.5 text-[11px]"
        style={{ color: 'var(--volans-primary)' }}
      >
        詳細一覧
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
