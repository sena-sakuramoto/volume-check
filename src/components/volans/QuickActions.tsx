import Link from 'next/link';
import { ChevronRight, Sparkles, Layers, FileText } from 'lucide-react';
import { VOLANS_DEMO } from '@/lib/volans-demo';

const iconOf: Record<string, React.ComponentType<{ className?: string }>> = {
  'ai-plan': Sparkles,
  'pattern-add': Layers,
  'doc-gen': FileText,
};

const hrefOf: Record<string, string> = {
  'ai-plan': '/m/ai',
  'pattern-add': '/m/compare',
  'doc-gen': '/m/report',
};

export function QuickActions() {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'var(--volans-surface)',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div className="text-[12px] font-semibold" style={{ color: 'var(--volans-text)' }}>
        クイックアクション
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {VOLANS_DEMO.quickActions.map((a) => {
          const Icon = iconOf[a.id] ?? Sparkles;
          const href = hrefOf[a.id] ?? '/sky';
          return (
            <Link
              key={a.id}
              href={href}
              className="group flex items-start gap-2 rounded-md px-2 py-2 text-left transition-all hover:bg-slate-50 hover:translate-x-0.5"
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded transition-colors group-hover:bg-[var(--volans-primary)] group-hover:text-white"
                style={{
                  background: 'var(--volans-primary-soft)',
                  color: 'var(--volans-primary)',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 leading-snug">
                <span
                  className="block text-[12px] font-medium"
                  style={{ color: 'var(--volans-text)' }}
                >
                  {a.title}
                </span>
                <span
                  className="block text-[10px]"
                  style={{ color: 'var(--volans-muted)' }}
                >
                  {a.sub}
                </span>
              </span>
              <ChevronRight
                className="mt-1 h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--volans-primary)]"
                style={{ color: 'var(--volans-muted)' }}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
