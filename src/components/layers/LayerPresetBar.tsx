'use client';

import { useViewerStore } from '@/stores/useViewerStore';
import { LayoutGrid } from 'lucide-react';
import { Cube, SunDim } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { PRESET_DEFS } from './layer-presets';

const ICON_MAP = { Box: Cube, Sun: SunDim, LayoutGrid } as const;

export function LayerPresetBar() {
  const { preset, selectPreset } = useViewerStore();

  return (
    <div className="absolute top-3 left-3 z-20">
      {/* Preset buttons */}
      <div className="flex gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-lg">
        {PRESET_DEFS.map((def) => {
          const Icon = ICON_MAP[def.icon as keyof typeof ICON_MAP];
          const isActive = preset === def.key;
          return (
            <button
              key={def.key}
              onClick={() => selectPreset(def.key)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{def.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
