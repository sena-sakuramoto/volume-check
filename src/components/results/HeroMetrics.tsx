'use client';

import type { VolumeResult } from '@/engine/types';
import { cn } from '@/lib/cn';

interface HeroMetricsProps {
  result: VolumeResult | null;
  className?: string;
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold font-display text-foreground leading-none">
        {value}
        <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export function HeroMetrics({ result, className }: HeroMetricsProps) {
  if (!result) return null;

  return (
    <div className={cn('flex items-center justify-center gap-6 rounded-lg bg-card/90 backdrop-blur-sm border border-border px-4 py-2.5 shadow-lg', className)}>
      <Metric
        label="最大高さ"
        value={Number.isFinite(result.maxHeight) ? result.maxHeight.toFixed(1) : '---'}
        unit="m"
      />
      <div className="w-px h-8 bg-border" />
      <Metric
        label="階数"
        value={`${result.maxFloors}`}
        unit="F"
      />
      <div className="w-px h-8 bg-border" />
      <Metric
        label="延べ面積"
        value={result.maxFloorArea.toFixed(0)}
        unit="m²"
      />
    </div>
  );
}
