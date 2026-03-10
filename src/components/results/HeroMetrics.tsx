'use client';

import type { VolumeResult } from '@/engine/types';
import { cn } from '@/lib/cn';

interface HeroMetricsProps {
  result: VolumeResult | null;
  className?: string;
  compact?: boolean;
}

function MetricCard({
  label,
  value,
  unit,
  compact = false,
}: {
  label: string;
  value: string;
  unit: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'ui-surface min-w-[108px] px-4 py-3 text-center',
        compact && 'min-w-0 rounded-2xl px-3 py-2.5',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-medium tracking-[0.14em] text-muted-foreground',
          compact && 'text-[9px] tracking-[0.12em]',
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          'mt-2 font-display text-2xl font-semibold leading-none text-foreground',
          compact && 'mt-1.5 text-lg',
        )}
      >
        {value}
        <span className={cn('ml-1 text-sm font-normal text-muted-foreground', compact && 'text-[11px]')}>
          {unit}
        </span>
      </div>
    </div>
  );
}

export function HeroMetrics({ result, className, compact = false }: HeroMetricsProps) {
  if (!result) return null;

  return (
    <div className={cn('grid grid-cols-3 gap-2', compact && 'gap-1.5', className)}>
      <MetricCard
        label="最高高さ"
        value={Number.isFinite(result.maxHeight) ? result.maxHeight.toFixed(1) : '---'}
        unit="m"
        compact={compact}
      />
      <MetricCard label="階数" value={`${result.maxFloors}`} unit="F" compact={compact} />
      <MetricCard
        label="延床面積"
        value={result.maxFloorArea.toFixed(0)}
        unit="m²"
        compact={compact}
      />
    </div>
  );
}
