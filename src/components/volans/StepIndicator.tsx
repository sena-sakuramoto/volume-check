import Link from 'next/link';
import { STEP_LABELS } from '@/lib/volans-demo';

interface StepIndicatorProps {
  activeId: number;
  compact?: boolean;
}

const STEP_HREF: Record<number, string> = {
  1: '/m/input',
  2: '/m/input',
  3: '/sky',
};

export function StepIndicator({ activeId, compact = false }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((s, i) => {
        const active = s.id === activeId;
        const done = s.id < activeId;
        const href = STEP_HREF[s.id];
        const content = (
          <div
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1 transition-all cursor-pointer hover:brightness-95',
              compact ? 'text-[10px]' : 'text-[11px]',
            ].join(' ')}
            style={{
              background: active
                ? 'var(--volans-primary)'
                : done
                  ? 'var(--volans-primary-soft)'
                  : 'transparent',
              color: active
                ? '#ffffff'
                : done
                  ? 'var(--volans-primary-strong)'
                  : 'var(--volans-muted)',
              border: active ? 'none' : `1px solid var(--volans-border)`,
              boxShadow: active ? '0 2px 8px rgba(59,109,225,0.25)' : 'none',
            }}
          >
            <span
              className="font-semibold tabular-nums"
              style={{ opacity: done ? 0.8 : 1 }}
            >
              {String(s.id).padStart(2, '0')}
            </span>
            <span>{s.label}</span>
          </div>
        );
        return (
          <div key={s.id} className="flex items-center gap-1.5">
            {href ? <Link href={href}>{content}</Link> : content}
            {i < STEP_LABELS.length - 1 && (
              <span
                className="inline-block h-px w-4 transition-colors"
                style={{
                  background: s.id < activeId ? 'var(--volans-primary)' : 'var(--volans-border)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
