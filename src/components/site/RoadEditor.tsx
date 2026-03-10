'use client';

import { useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SiteBoundary } from '@/engine/types';
import { Input } from '@/components/ui/shadcn/input';
import {
  getOppositeOpenSpaceLabel,
  ROAD_DIRECTION_OPTIONS,
  ROAD_WIDTH_PRESETS,
  OPPOSITE_OPEN_SPACE_OPTIONS,
} from './site-types';
import type { RoadConfig, RoadDirection } from './site-types';
import { cn } from '@/lib/cn';

interface RoadEditorProps {
  roadConfigs: RoadConfig[];
  onRoadConfigsChange: (configs: RoadConfig[]) => void;
  onCornerLotChange?: (isCorner: boolean) => void;
  site?: SiteBoundary | null;
  siteMode?: 'rect' | 'polygon';
  canUndo?: boolean;
  onUndo?: () => void;
  canRestoreSuggestions?: boolean;
  onRestoreSuggestions?: () => void;
  onResetRoads?: () => void;
}

function toBoundaryEdgeId(pair: [number, number], edgeCount: number): number | null {
  const [a, b] = pair;
  if (
    !Number.isInteger(a) ||
    !Number.isInteger(b) ||
    a < 0 ||
    b < 0 ||
    a >= edgeCount ||
    b >= edgeCount
  ) {
    return null;
  }
  if (b === (a + 1) % edgeCount) return a;
  if (a === (b + 1) % edgeCount) return b;
  return null;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function formatRoadAdjustmentSummary(config: RoadConfig): string | null {
  const parts: string[] = [];
  if ((config.frontSetback ?? 0) > 0) parts.push(`前面後退 ${config.frontSetback}m`);
  if ((config.oppositeSideSetback ?? 0) > 0) {
    parts.push(`対側後退 ${config.oppositeSideSetback}m`);
  }
  if ((config.oppositeOpenSpace ?? 0) > 0) {
    parts.push(`対側空地 ${config.oppositeOpenSpace}m`);
  }
  if (config.oppositeOpenSpaceKind && config.oppositeOpenSpaceKind !== 'none') {
    parts.push(`種別 ${getOppositeOpenSpaceLabel(config.oppositeOpenSpaceKind)}`);
  }
  if ((config.slopeWidthOverride ?? 0) > 0) {
    parts.push(`斜線基準幅 ${config.slopeWidthOverride}m`);
  }
  if ((config.siteHeightAboveRoad ?? 0) !== 0) {
    parts.push(`高低差 ${config.siteHeightAboveRoad}m`);
  }
  if (config.enableTwoA35m === true) parts.push('2A / 35m');
  return parts.length > 0 ? parts.join(' / ') : null;
}

function getSourceLabel(sources: string[]): string {
  if (sources.includes('api')) return 'API候補';
  if (sources.includes('ai')) return 'AI候補';
  return '自動候補';
}

function getConfidenceLabel(value: RoadConfig['confidence']) {
  if (value === 'high') return '高';
  if (value === 'medium') return '中';
  if (value === 'low') return '低';
  return null;
}

export function RoadEditor({
  roadConfigs,
  onRoadConfigsChange,
  onCornerLotChange,
  site,
  siteMode = 'rect',
  canUndo = false,
  onUndo,
  canRestoreSuggestions = false,
  onRestoreSuggestions,
  onResetRoads,
}: RoadEditorProps) {
  const edgeCount = site?.vertices.length ?? 0;
  const polygonMaxRoads = Math.max(1, edgeCount);
  const maxRoads = siteMode === 'polygon' ? polygonMaxRoads : 4;
  const canAddRoad = roadConfigs.length < maxRoads;
  const suggestedCount = roadConfigs.filter(
    (config) => (config.reviewStatus ?? 'confirmed') === 'suggested',
  ).length;
  const suggestedSources = Array.from(
    new Set(
      roadConfigs
        .filter((config) => (config.reviewStatus ?? 'confirmed') === 'suggested')
        .map((config) => config.source ?? 'manual'),
    ),
  );

  const handleAddRoad = useCallback(() => {
    if (roadConfigs.length >= maxRoads) return;
    const usedDirections = roadConfigs.map((road) => road.direction);
    const availableDirection = (['south', 'east', 'west', 'north'] as RoadDirection[]).find(
      (direction) => !usedDirections.includes(direction),
    ) ?? 'south';

    const nextConfigs: RoadConfig[] = [
      ...roadConfigs,
      {
        id: String(Date.now()),
        width: 6,
        direction: availableDirection,
        customWidth: '',
        source: 'manual',
        reviewStatus: 'confirmed',
      },
    ];
    onRoadConfigsChange(nextConfigs);
    if (nextConfigs.length >= 2) onCornerLotChange?.(true);
  }, [maxRoads, onCornerLotChange, onRoadConfigsChange, roadConfigs]);

  const handleRemoveRoad = useCallback((id: string) => {
    const nextConfigs = roadConfigs.filter((road) => road.id !== id);
    onRoadConfigsChange(nextConfigs);
    if (nextConfigs.length < 2) onCornerLotChange?.(false);
  }, [onCornerLotChange, onRoadConfigsChange, roadConfigs]);

  const updateRoad = useCallback((id: string, patch: Partial<RoadConfig>) => {
    const nextConfigs = roadConfigs.map((road) =>
      road.id === id ? { ...road, ...patch, reviewStatus: patch.reviewStatus ?? 'confirmed' } : road,
    );
    onRoadConfigsChange(nextConfigs);
  }, [onRoadConfigsChange, roadConfigs]);

  const handleConfirmSuggestions = useCallback(() => {
    onRoadConfigsChange(
      roadConfigs.map((config) => ({
        ...config,
        reviewStatus: 'confirmed',
      })),
    );
  }, [onRoadConfigsChange, roadConfigs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">接道設定</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {canUndo && onUndo ? (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-full border border-border/80 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:bg-white"
            >
              1手戻す
            </button>
          ) : null}
          {canRestoreSuggestions && onRestoreSuggestions ? (
            <button
              type="button"
              onClick={onRestoreSuggestions}
              className="rounded-full border border-amber-300 bg-amber-50/90 px-2.5 py-1 text-[10px] font-medium text-amber-900 transition-colors hover:bg-amber-50"
            >
              候補に戻す
            </button>
          ) : null}
          {onResetRoads ? (
            <button
              type="button"
              onClick={onResetRoads}
              className="rounded-full border border-border/80 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
            >
              手入力に戻す
            </button>
          ) : null}
          {canAddRoad ? (
            <button
              type="button"
              onClick={handleAddRoad}
              className="flex items-center gap-1 text-[10px] text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="h-3 w-3" />
              道路を追加
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-[10px] leading-5 text-muted-foreground">
        まずは幅員だけ合っていれば十分です。後から接する辺や緩和条件を追加してもやり直せます。
      </p>

      {suggestedCount > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-amber-950">
                {getSourceLabel(suggestedSources)} を {suggestedCount} 件読み込みました
              </p>
              <p className="mt-1 text-[10px] leading-5 text-amber-800">
                どの辺が前面道路か、幅員が妥当かを確認してからそのまま確定できます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmSuggestions}
              className="shrink-0 rounded-lg border border-amber-300 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-amber-900 transition-colors hover:bg-white"
            >
              この内容で確定
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {roadConfigs.map((config, index) => (
          <div key={config.id} className="rounded-2xl border border-border bg-card/55 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">道路 {index + 1}</span>
                {config.source && config.source !== 'manual' ? (
                  <span className="rounded-full border border-border/80 bg-white/80 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {config.source === 'api' ? 'API' : config.source === 'ai' ? 'AI' : 'DEMO'}
                  </span>
                ) : null}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                    (config.reviewStatus ?? 'confirmed') === 'suggested'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-emerald-100 text-emerald-800',
                  )}
                >
                  {(config.reviewStatus ?? 'confirmed') === 'suggested' ? '確認待ち' : '確認済み'}
                </span>
                {getConfidenceLabel(config.confidence) ? (
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-700">
                    信頼度 {getConfidenceLabel(config.confidence)}
                  </span>
                ) : null}
              </div>
              {roadConfigs.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveRoad(config.id)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {config.sourceLabel || config.sourceDetail || config.reasoning ? (
              <div className="rounded-xl border border-border/70 bg-white/70 px-2.5 py-2 text-[10px] text-muted-foreground">
                {config.sourceLabel ? <p>参照ソース: {config.sourceLabel}</p> : null}
                {config.sourceDetail ? <p className="mt-1">参照情報: {config.sourceDetail}</p> : null}
                {typeof config.distance === 'number' ? (
                  <p className="mt-1">敷地辺までの距離: {config.distance.toFixed(2)}m</p>
                ) : null}
                {config.reasoning ? (
                  <p className="mt-1 leading-5 text-foreground/75">{config.reasoning}</p>
                ) : null}
              </div>
            ) : null}

            {formatRoadAdjustmentSummary(config) ? (
              <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-2.5 py-2 text-[10px] text-sky-950">
                斜線補正: {formatRoadAdjustmentSummary(config)}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-1.5">
              {ROAD_DIRECTION_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateRoad(config.id, { direction: key })}
                  className={cn(
                    'rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                    config.direction === key
                      ? 'bg-secondary text-foreground'
                      : 'bg-secondary/55 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {siteMode === 'polygon' && edgeCount >= 2 && site ? (
              <div className="space-y-1">
                <label className="block text-[10px] text-muted-foreground">接する辺</label>
                {(() => {
                  const usedEdgeIds = new Set(
                    roadConfigs
                      .filter((other) => other.id !== config.id && other.edgeVertexIndices)
                      .map((other) => toBoundaryEdgeId(other.edgeVertexIndices!, edgeCount))
                      .filter((id): id is number => id !== null),
                  );

                  return (
                    <select
                      value={
                        config.edgeVertexIndices
                          ? `${config.edgeVertexIndices[0]}-${config.edgeVertexIndices[1]}`
                          : 'auto'
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === 'auto') {
                          updateRoad(config.id, { edgeVertexIndices: undefined });
                          return;
                        }
                        const [start, end] = value.split('-').map((item) => Number.parseInt(item, 10));
                        if (Number.isInteger(start) && Number.isInteger(end)) {
                          updateRoad(config.id, { edgeVertexIndices: [start, end] });
                        }
                      }}
                      className="h-9 w-full rounded-xl border border-input bg-transparent px-3 text-[11px] text-foreground"
                    >
                      <option value="auto">自動選択</option>
                      {site.vertices.map((_, i) => {
                        const j = (i + 1) % edgeCount;
                        const start = site.vertices[i];
                        const end = site.vertices[j];
                        const length = Math.hypot(end.x - start.x, end.y - start.y);
                        const disabled = usedEdgeIds.has(i);
                        return (
                          <option key={`${i}-${j}`} value={`${i}-${j}`} disabled={disabled}>
                            辺 {i + 1}: 頂点 {i + 1}-{j + 1} ({length.toFixed(1)}m)
                            {disabled ? ' / 使用中' : ''}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-1.5">
              {ROAD_WIDTH_PRESETS.map((width) => (
                <button
                  key={width}
                  type="button"
                  onClick={() => updateRoad(config.id, { width, customWidth: '' })}
                  className={cn(
                    'rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                    config.width === width && !config.customWidth
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                >
                  {width}m
                </button>
              ))}
            </div>

            <Input
              type="number"
              value={config.customWidth}
              onChange={(event) => {
                const value = event.target.value;
                const parsed = parseFloat(value);
                updateRoad(config.id, {
                  customWidth: value,
                  ...(!Number.isNaN(parsed) && parsed > 0 ? { width: parsed } : {}),
                });
              }}
              placeholder="幅員を直接入力 (m)"
              min="2"
              max="50"
              step="0.5"
              className="h-9 text-sm"
            />

            <details className="rounded-xl border border-border/70 bg-white/70">
              <summary className="cursor-pointer list-none px-3 py-3 text-[11px] font-medium text-foreground">
                道路斜線の詳細設定
                <span className="ml-1 text-muted-foreground">
                  前面後退 / 対側空地 / 斜線基準幅 / 高低差
                </span>
              </summary>
              <div className="space-y-3 border-t border-border/70 px-3 py-3">
                <p className="text-[10px] leading-5 text-muted-foreground">
                  API や図面読取では拾い切れない条件だけ入れてください。不要なら 0 のままで構いません。
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] text-muted-foreground">前面後退 (m)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={config.frontSetback ?? ''}
                      onChange={(event) => updateRoad(config.id, {
                        frontSetback: parseOptionalNumber(event.target.value),
                      })}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      className="h-8 text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-muted-foreground">対側後退 (m)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={config.oppositeSideSetback ?? ''}
                      onChange={(event) => updateRoad(config.id, {
                        oppositeSideSetback: parseOptionalNumber(event.target.value),
                      })}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      className="h-8 text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-muted-foreground">対側空地 (m)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={config.oppositeOpenSpace ?? ''}
                      onChange={(event) => updateRoad(config.id, {
                        oppositeOpenSpace: parseOptionalNumber(event.target.value),
                      })}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      className="h-8 text-[11px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-muted-foreground">対側空地の種別</label>
                    <select
                      value={config.oppositeOpenSpaceKind ?? 'none'}
                      onChange={(event) => {
                        const nextKind = event.target.value as RoadConfig['oppositeOpenSpaceKind'];
                        updateRoad(config.id, {
                          oppositeOpenSpaceKind: nextKind,
                          ...(nextKind === 'none' ? { oppositeOpenSpace: undefined } : {}),
                        });
                      }}
                      className="h-8 w-full rounded-xl border border-input bg-transparent px-3 text-[11px] text-foreground"
                    >
                      {OPPOSITE_OPEN_SPACE_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] text-muted-foreground">斜線基準幅 (m)</label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={config.slopeWidthOverride ?? ''}
                      onChange={(event) => updateRoad(config.id, {
                        slopeWidthOverride: parseOptionalNumber(event.target.value),
                      })}
                      placeholder="例 8"
                      min="0"
                      step="0.1"
                      className="h-8 text-[11px]"
                    />
                  </div>
                </div>

                {(() => {
                  const option = OPPOSITE_OPEN_SPACE_OPTIONS.find(
                    (item) => item.key === (config.oppositeOpenSpaceKind ?? 'none'),
                  );
                  return option && option.key !== 'none' ? (
                    <p className="text-[10px] leading-5 text-muted-foreground">{option.hint}</p>
                  ) : null;
                })()}

                <div className="space-y-1">
                  <label className="block text-[10px] text-muted-foreground">
                    高低差 (m)
                    <span className="ml-1 text-[9px]">敷地が道路より高い場合はプラス</span>
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={config.siteHeightAboveRoad ?? ''}
                    onChange={(event) => updateRoad(config.id, {
                      siteHeightAboveRoad: parseOptionalNumber(event.target.value),
                    })}
                    placeholder="例 1.2"
                    step="0.1"
                    className="h-8 text-[11px]"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-slate-50/70 px-3 py-3 text-[11px] text-foreground">
                  <input
                    type="checkbox"
                    checked={config.enableTwoA35m ?? false}
                    onChange={(event) => updateRoad(config.id, { enableTwoA35m: event.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  2Aかつ35m以内の緩和を使う
                </label>
                <p className="text-[10px] leading-5 text-muted-foreground">
                  幅員の大きい前面道路がある場合や、他の前面道路中心線から 10m を超える範囲で使う想定です。
                </p>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
