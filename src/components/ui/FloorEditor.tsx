'use client';

import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/cn';

interface FloorEditorProps {
  maxFloors: number;
  maxHeight: number;
  floorHeights: number[];
  onFloorHeightsChange: (heights: number[]) => void;
}

const FIRST_FLOOR_PRESETS = [2.8, 3.0, 3.5, 4.0];
const UPPER_FLOOR_PRESETS = [2.8, 3.0, 3.2];

export function FloorEditor({
  maxFloors,
  maxHeight,
  floorHeights,
  onFloorHeightsChange,
}: FloorEditorProps) {
  if (!maxFloors || maxFloors <= 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">階高設定</h3>
        <p className="text-xs text-muted-foreground text-center py-4">
          敷地データを入力してください
        </p>
      </div>
    );
  }

  const totalHeight = floorHeights.reduce((sum, h) => sum + h, 0);
  const remaining = maxHeight - totalHeight;
  const isOverBudget = remaining < 0;

  const handleHeightChange = (index: number, value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return;
    const next = [...floorHeights];
    next[index] = parsed;
    onFloorHeightsChange(next);
  };

  const handlePreset = (index: number, value: number) => {
    const next = [...floorHeights];
    next[index] = value;
    onFloorHeightsChange(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-muted-foreground">階高設定</h3>
        <Button
          onClick={() => onFloorHeightsChange(Array(maxFloors).fill(3.0))}
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2"
        >
          全階リセット
        </Button>
      </div>

      <div className="space-y-1.5">
        {floorHeights.map((height, i) => {
          const presets = i === 0 ? FIRST_FLOOR_PRESETS : UPPER_FLOOR_PRESETS;
          return (
            <div key={i} className="rounded-lg bg-card border border-border px-2.5 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground w-6 shrink-0">
                  {i + 1}F
                </span>
                <Input
                  type="number"
                  value={height}
                  onChange={(e) => handleHeightChange(i, e.target.value)}
                  step="0.1"
                  min="2.0"
                  max="10"
                  className="w-16 h-6 text-xs text-right"
                />
                <span className="text-[10px] text-muted-foreground">m</span>
                <div className="flex gap-0.5 ml-auto">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePreset(i, preset)}
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                        height === preset
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-2 rounded-lg bg-card border border-border px-2.5 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">合計高さ</span>
          <span className={cn('text-xs font-bold', isOverBudget ? 'text-destructive' : 'text-foreground')}>
            {totalHeight.toFixed(1)}m
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground">残り</span>
          <span className={cn('text-xs font-medium', isOverBudget ? 'text-destructive' : 'text-emerald-400')}>
            {remaining.toFixed(1)}m
          </span>
        </div>
        {isOverBudget && (
          <p className="mt-1 text-[10px] text-destructive">
            最大高さ ({maxHeight.toFixed(1)}m) を超過しています
          </p>
        )}
      </div>
    </div>
  );
}
