'use client';

import type { PatternResult, BuildingPatternResult } from '@/engine/types';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/shadcn/badge';
import { useViewerStore, type PatternKey } from '@/stores/useViewerStore';

function PatternCard({
  pattern,
  patternKey,
  isBest,
  isSelected,
  onSelect,
}: {
  pattern: PatternResult;
  patternKey: PatternKey;
  isBest: boolean;
  isSelected: boolean;
  onSelect: (key: PatternKey | null) => void;
}) {
  const footprintValid = pattern.footprintArea > 0 && pattern.footprint.length >= 3;
  const passLabel = footprintValid
    ? (pattern.compliance.passes ? '適合' : '不適合')
    : '適用不可';
  const passColor = footprintValid
    ? (pattern.compliance.passes ? 'text-emerald-400' : 'text-red-400')
    : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border bg-card px-3 py-2.5 transition-all',
        isSelected
          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
          : isBest
            ? 'border-primary/50 hover:border-primary/30'
            : 'border-border hover:border-primary/30',
      )}
      onClick={() => onSelect(isSelected ? null : patternKey)}
    >
      <div className="flex items-center justify-between text-xs font-semibold text-foreground mb-1.5">
        <span>{pattern.name}</span>
        {isBest && <Badge variant="default" className="text-[9px] h-4 px-1.5">最適</Badge>}
      </div>
      <div className="space-y-0.5 text-xs">
        <Row label="階数/高さ" value={`${pattern.maxFloors}F / ${pattern.maxHeight}m`} />
        <Row label="建築面積" value={`${pattern.footprintArea}m²`} />
        <Row label="延べ面積" value={`${pattern.totalFloorArea}m²`} />
        {typeof pattern.inset === 'number' && (
          <Row label="追加後退" value={`${pattern.inset.toFixed(1)}m`} />
        )}
        {footprintValid && (
          <>
            <Row label="5m日影" value={`${pattern.compliance.worstHoursAt5m.toFixed(1)}h`} />
            <Row label="10m日影" value={`${pattern.compliance.worstHoursAt10m.toFixed(1)}h`} />
          </>
        )}
        {!footprintValid && (
          <p className="text-[10px] text-muted-foreground pt-1">
            5mインセットが敷地内に収まらず、評価対象外
          </p>
        )}
        <div className={cn('flex items-center justify-end gap-1 pt-1 font-semibold', passColor)}>
          <span>{footprintValid ? (pattern.compliance.passes ? '\u2713' : '\u2717') : '\u2014'}</span>
          <span>{passLabel}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{value}</span>
    </div>
  );
}

interface PatternComparisonProps {
  patterns: BuildingPatternResult;
}

export function PatternComparison({ patterns }: PatternComparisonProps) {
  const selectedPattern = useViewerStore((s) => s.selectedPattern);
  const selectPattern = useViewerStore((s) => s.selectPattern);
  const { lowRise, midHighRise, optimal } = patterns;
  const candidates = [lowRise, midHighRise, optimal].filter((p) => p.footprintArea > 0);
  const best = candidates.length > 0
    ? candidates.reduce((a, b) => (b.totalFloorArea > a.totalFloorArea ? b : a))
    : null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground">建物パターン比較</h3>
      <div className="grid grid-cols-1 gap-2">
        <PatternCard
          pattern={lowRise}
          patternKey="lowRise"
          isBest={best?.name === lowRise.name}
          isSelected={selectedPattern === 'lowRise'}
          onSelect={selectPattern}
        />
        <PatternCard
          pattern={midHighRise}
          patternKey="midHighRise"
          isBest={best?.name === midHighRise.name}
          isSelected={selectedPattern === 'midHighRise'}
          onSelect={selectPattern}
        />
        <PatternCard
          pattern={optimal}
          patternKey="optimal"
          isBest={best?.name === optimal.name}
          isSelected={selectedPattern === 'optimal'}
          onSelect={selectPattern}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        パターンをクリックすると3Dビューで該当ボリュームを表示します。
      </p>
      <p className="text-[10px] text-muted-foreground">
        最適パターンは「追加後退」を自動探索し、延べ面積が最大となる形状を提示します。
      </p>
    </div>
  );
}
