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
              'flex items-center gap-1.5 rounded-full px-3 py-1 transition cursor-pointer',
              compact ? 'text-[10px]' : 'text-[11px]',
            ].join(' ')}
            style={{
              background: active ? 'var(--volans-primary)' : 'transparent',
              color: active
                ? '#ffffff'
                : done
                  ? 'var(--volans-text)'
                  : 'var(--volans-muted)',
              border: active ? 'none' : `1px solid var(--volans-border)`,
            }}
          >
            <span className="font-semibold tabular-nums">
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
                className="inline-block h-px w-4"
                style={{ background: 'var(--volans-border)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
