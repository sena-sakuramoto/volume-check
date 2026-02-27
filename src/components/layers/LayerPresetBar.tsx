'use client';

import { useState } from 'react';
import type { LayerPreset, LayerState } from '@/hooks/useLayerPresets';
import { LayoutGrid, Settings2 } from 'lucide-react';
import { Cube, SunDim } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';
import { PRESET_DEFS, LAYER_GROUPS } from './layer-presets';

const ICON_MAP = { Box: Cube, Sun: SunDim, LayoutGrid, Settings2 } as const;

interface LayerPresetBarProps {
  preset: LayerPreset;
  layers: LayerState;
  onSelectPreset: (p: LayerPreset) => void;
  onToggleLayer: (key: keyof LayerState) => void;
}

export function LayerPresetBar({
  preset,
  layers,
  onSelectPreset,
  onToggleLayer,
}: LayerPresetBarProps) {
  const [showCustom, setShowCustom] = useState(false);

  return (
    <div className="absolute top-3 left-3 z-20 space-y-2">
      {/* Preset buttons */}
      <div className="flex gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-lg">
        {PRESET_DEFS.map((def) => {
          const Icon = ICON_MAP[def.icon as keyof typeof ICON_MAP];
          const isActive = preset === def.key;
          return (
            <button
              key={def.key}
              onClick={() => {
                onSelectPreset(def.key);
                if (def.key === 'custom') setShowCustom((v) => !v);
                else setShowCustom(false);
              }}
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

      {/* Custom layer panel */}
      {preset === 'custom' && showCustom && (
        <div className="rounded-lg bg-card/95 backdrop-blur-sm border border-border p-3 shadow-lg max-h-[50vh] overflow-y-auto w-56">
          {LAYER_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <input
                      type="checkbox"
                      checked={layers[item.key as keyof LayerState] ?? false}
                      onChange={() => onToggleLayer(item.key as keyof LayerState)}
                      className="h-3 w-3 rounded border-border bg-input text-primary"
                    />
                    <span className="text-[11px] text-foreground/80">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
