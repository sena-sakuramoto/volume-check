'use client';

import { useCallback } from 'react';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { Plus, Trash2 } from 'lucide-react';
import type { RoadConfig, RoadDirection } from './site-types';
import { ROAD_WIDTH_PRESETS, ROAD_DIRECTION_OPTIONS } from './site-types';
import { cn } from '@/lib/cn';

interface RoadEditorProps {
  roadConfigs: RoadConfig[];
  onRoadConfigsChange: (configs: RoadConfig[]) => void;
  onCornerLotChange?: (isCorner: boolean) => void;
}

export function RoadEditor({
  roadConfigs,
  onRoadConfigsChange,
  onCornerLotChange,
}: RoadEditorProps) {
  const handleAddRoad = useCallback(() => {
    if (roadConfigs.length >= 4) return;
    const usedDirs = roadConfigs.map((r) => r.direction);
    const availableDir = (['south', 'east', 'west', 'north'] as RoadDirection[]).find(
      (d) => !usedDirs.includes(d),
    ) ?? 'south';
    const newConfigs = [
      ...roadConfigs,
      { id: String(Date.now()), width: 6, direction: availableDir, customWidth: '' },
    ];
    onRoadConfigsChange(newConfigs);
    if (newConfigs.length >= 2) onCornerLotChange?.(true);
  }, [roadConfigs, onRoadConfigsChange, onCornerLotChange]);

  const handleRemoveRoad = useCallback(
    (id: string) => {
      const newConfigs = roadConfigs.filter((r) => r.id !== id);
      onRoadConfigsChange(newConfigs);
      if (newConfigs.length < 2) onCornerLotChange?.(false);
    },
    [roadConfigs, onRoadConfigsChange, onCornerLotChange],
  );

  const updateRoad = useCallback(
    (id: string, patch: Partial<RoadConfig>) => {
      const newConfigs = roadConfigs.map((r) =>
        r.id === id ? { ...r, ...patch } : r,
      );
      onRoadConfigsChange(newConfigs);
    },
    [roadConfigs, onRoadConfigsChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">前面道路</label>
        {roadConfigs.length < 4 && (
          <button
            onClick={handleAddRoad}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-3 w-3" />
            道路を追加
          </button>
        )}
      </div>

      <div className="space-y-2">
        {roadConfigs.map((rc, idx) => (
          <div key={rc.id} className="rounded-lg border border-border bg-card/50 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">道路 {idx + 1}</span>
              {roadConfigs.length > 1 && (
                <button
                  onClick={() => handleRemoveRoad(rc.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Direction */}
            <div className="flex gap-1">
              {ROAD_DIRECTION_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => updateRoad(rc.id, { direction: key })}
                  className={cn(
                    'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    rc.direction === key
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Width presets */}
            <div className="flex gap-1">
              {ROAD_WIDTH_PRESETS.map((w) => (
                <button
                  key={w}
                  onClick={() => updateRoad(rc.id, { width: w, customWidth: '' })}
                  className={cn(
                    'flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors',
                    rc.width === w && !rc.customWidth
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {w}m
                </button>
              ))}
            </div>

            <Input
              type="number"
              value={rc.customWidth}
              onChange={(e) => {
                const v = e.target.value;
                const parsed = parseFloat(v);
                updateRoad(rc.id, {
                  customWidth: v,
                  ...((!isNaN(parsed) && parsed > 0) ? { width: parsed } : {}),
                });
              }}
              placeholder="その他 (m)"
              min="2"
              max="50"
              step="0.5"
              className="h-7 text-[10px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
