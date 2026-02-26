'use client';

import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import { getRoadSetbackParams, getAdjacentSetbackParams, getNorthSetbackParams } from '@/engine';
import { MAX_HEIGHT_CAP } from '@/engine/constants';
import { HeroMetrics } from '@/components/results/HeroMetrics';
import { PatternComparison } from '@/components/results/PatternComparison';
import { FloorTable } from '@/components/results/FloorTable';
import { ActionToolbar } from '@/components/results/ActionToolbar';
import { FloorEditor } from '@/components/ui/FloorEditor';

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function ResultValue({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-primary">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}

interface ResultsSectionProps {
  zoning: ZoningData | null;
  result: VolumeResult | null;
  site: SiteBoundary | null;
  roads: Road[];
  floorHeights: number[];
  latitude: number;
  onFloorHeightsChange: (heights: number[]) => void;
}

export function ResultsSection({
  zoning,
  result,
  site,
  roads,
  floorHeights,
  latitude,
  onFloorHeightsChange,
}: ResultsSectionProps) {
  if (!zoning) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center py-8">
          住所を入力して法規制を取得してください
        </p>
      </div>
    );
  }

  const roadParams = getRoadSetbackParams(zoning.district);
  const adjParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);

  return (
    <div className="space-y-4 p-4">
      {/* Hero */}
      <HeroMetrics result={result} />

      {/* Regulation Summary */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">法規制サマリー</h3>
        <div className="rounded-lg bg-card border border-border px-3 py-2 divide-y divide-border">
          <DataRow label="用途地域" value={zoning.district} />
          <DataRow label="建ぺい率" value={`${(zoning.coverageRatio * 100).toFixed(0)}%`} />
          <DataRow label="容積率" value={`${(zoning.floorAreaRatio * 100).toFixed(0)}%`} />
          <DataRow label="防火地域" value={zoning.fireDistrict} />
          <DataRow label="高度地区" value={zoning.heightDistrict?.type ?? '指定なし'} />
          <DataRow label="絶対高さ制限" value={zoning.absoluteHeightLimit !== null ? `${zoning.absoluteHeightLimit}m` : 'なし'} />
          <DataRow label="外壁後退" value={zoning.wallSetback !== null ? `${zoning.wallSetback}m` : 'なし'} />
          {zoning.isCornerLot && <DataRow label="角地緩和" value="適用 (+10%)" />}
        </div>
      </div>

      {/* Applied Setbacks */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2">適用斜線制限</h3>
        <div className="rounded-lg bg-card border border-border px-3 py-2 divide-y divide-border">
          <DataRow label="道路斜線" value={`勾配 ${roadParams.slopeRatio}`} />
          {roadParams.applicationDistance !== Infinity && (
            <DataRow label="適用距離" value={`${roadParams.applicationDistance}m`} />
          )}
          <DataRow label="隣地斜線" value={`${adjParams.riseHeight}m + ${adjParams.slopeRatio}D`} />
          {northParams && (
            <DataRow label="北側斜線" value={`${northParams.riseHeight}m + ${northParams.slopeRatio}D`} />
          )}
          {roads.length > 0 && (
            <DataRow
              label="道路幅員制限容積率"
              value={`${Math.round(Math.min(...roads.map((r) => r.width * 0.4)) * 100)}%`}
            />
          )}
        </div>
      </div>

      {/* Calculation Results */}
      {result && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">計算結果</h3>
          <div className="rounded-lg bg-card border border-border px-3 py-2 divide-y divide-border">
            <ResultValue label="最大延べ面積" value={result.maxFloorArea.toFixed(2)} unit="m²" />
            <ResultValue label="最大建築面積" value={result.maxCoverageArea.toFixed(2)} unit="m²" />
            <ResultValue label="最大高さ" value={Number.isFinite(result.maxHeight) ? result.maxHeight.toFixed(2) : '制限なし'} unit={Number.isFinite(result.maxHeight) ? 'm' : ''} />
            <ResultValue label="最大階数" value={`${result.maxFloors}`} unit="F" />
            <ResultValue label="計算上限" value={MAX_HEIGHT_CAP.toFixed(0)} unit="m" />
          </div>
        </div>
      )}

      {/* Pattern Comparison */}
      {result?.buildingPatterns && (
        <PatternComparison patterns={result.buildingPatterns} />
      )}
      {result && !result.buildingPatterns && (
        <div className="rounded-lg bg-card border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground">
            建物パターン比較は日影規制がある用途地域で自動計算されます。
          </p>
        </div>
      )}

      {/* Floor Editor */}
      <FloorEditor
        maxFloors={result?.maxFloors ?? 0}
        maxHeight={result?.maxHeight ?? 0}
        floorHeights={floorHeights}
        onFloorHeightsChange={onFloorHeightsChange}
      />

      {/* Floor Table */}
      {result && (
        <FloorTable floorHeights={floorHeights} maxHeight={result.maxHeight} />
      )}

      {/* Assumptions */}
      {result && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">計算前提</h3>
          <div className="rounded-lg bg-card border border-border px-3 py-2 text-[11px] text-muted-foreground space-y-1">
            <div>日影は冬至日（8:00-16:00）、10分刻みで評価</div>
            <div>計算上限高さは {MAX_HEIGHT_CAP.toFixed(0)}m</div>
            <div>建物パターンは日影規制を満たす最大高さを探索</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <ActionToolbar
        zoning={zoning}
        result={result}
        site={site}
        roads={roads}
        floorHeights={floorHeights}
        latitude={latitude}
      />
    </div>
  );
}
