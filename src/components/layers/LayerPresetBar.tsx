'use client';

import { Cube, SunDim } from '@phosphor-icons/react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useViewerStore } from '@/stores/useViewerStore';
import { PRESET_DEFS } from './layer-presets';

const ICON_MAP = { Box: Cube, Sun: SunDim, LayoutGrid } as const;

interface LayerPresetBarProps {
  className?: string;
  compact?: boolean;
}

export function LayerPresetBar({ className, compact = false }: LayerPresetBarProps) {
  const { preset, selectPreset } = useViewerStore();

  return (
    <div className={cn('absolute left-3 top-3 z-20', className)}>
      <div className={cn('ui-surface flex items-center gap-1 px-1 py-1', compact && 'gap-0.5 px-1 py-1')}>
        <span
          className={cn(
            'pl-2 pr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground',
            compact && 'pl-1.5 pr-0.5 text-[9px] tracking-[0.14em]',
          )}
        >
          表示
        </span>
        {PRESET_DEFS.map((definition) => {
          const Icon = ICON_MAP[definition.icon as keyof typeof ICON_MAP];
          const isActive = preset === definition.key;

          return (
            <button
              key={definition.key}
              type="button"
              onClick={() => selectPreset(definition.key)}
              className={cn(
                'flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors',
                compact && 'gap-1 rounded-full px-2.5 py-1.5 text-[10px]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', compact && 'h-3 w-3')} />
              <span>{definition.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
