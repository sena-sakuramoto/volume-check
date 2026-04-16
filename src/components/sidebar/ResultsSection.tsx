'use client';

import { useState } from 'react';
import type { ZoningData, VolumeResult, SiteBoundary, Road } from '@/engine/types';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
  getHeightDistrictParams,
} from '@/engine';
import { MAX_HEIGHT_CAP } from '@/engine/constants';
import { HeroMetrics } from '@/components/results/HeroMetrics';
import { PatternComparison } from '@/components/results/PatternComparison';
import {
  FeasibilitySection,
  type FeasibilitySnapshot,
} from '@/components/results/FeasibilitySection';
import { FloorTable } from '@/components/results/FloorTable';
import { ActionToolbar } from '@/components/results/ActionToolbar';
import { FloorEditor } from '@/components/ui/FloorEditor';
import { Input } from '@/components/ui/shadcn/input';

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
  onFloorHeightsChange: (heights: number[]) => void;
}

export function ResultsSection({
  zoning,
  result,
  site,
  roads,
  floorHeights,
  onFloorHeightsChange,
}: ResultsSectionProps) {
  const [landPriceInput, setLandPriceInput] = useState('');
  const [feasibilitySnapshot, setFeasibilitySnapshot] = useState<FeasibilitySnapshot | null>(null);
  const landPrice = parseFloat(landPriceInput);
  const floorAreaTsubo = result ? result.maxFloorArea / 3.30579 : 0;
  const ichishuUnitPrice =
    result && Number.isFinite(landPrice) && landPrice > 0 && floorAreaTsubo > 0
      ? landPrice / floorAreaTsubo
      : null;

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
          <DataRow
            label="絶対高さ制限"
            value={(() => {
              if (zoning.absoluteHeightLimit !== null) return `${zoning.absoluteHeightLimit}m`;
              const hdType = zoning.heightDistrict?.type;
              if (hdType && hdType !== '指定なし') {
                const hdParams = getHeightDistrictParams(hdType);
                if (hdParams) return `${hdParams.absoluteMax}m (高度地区)`;
              }
              return 'なし';
            })()}
          />
          <DataRow label="外壁後退" value={zoning.wallSetback !== null ? `${zoning.wallSetback}m` : 'なし'} />
          {zoning.shadowRegulation && (
            <DataRow
              label="日影規制"
              value={`測定高${zoning.shadowRegulation.measurementHeight}m / 5m:${zoning.shadowRegulation.maxHoursAt5m}h・10m:${zoning.shadowRegulation.maxHoursAt10m}h`}
            />
          )}
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
          {(() => {
            const hdType = zoning.heightDistrict?.type;
            if (!hdType || hdType === '指定なし') return null;
            const hdParams = getHeightDistrictParams(hdType);
            if (!hdParams) return null;
            return (
              <>
                <DataRow label="高度地区斜線" value={`${hdParams.maxAtBoundary}m + ${hdParams.slope}勾配`} />
                <DataRow label="高度地区上限" value={`${hdParams.absoluteMax}m`} />
              </>
            );
          })()}
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
          <div className="rounded-lg bg-card border border-border px-3 py-2 mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">土地価格</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={landPriceInput}
                  onChange={(e) => setLandPriceInput(e.target.value)}
                  placeholder="例: 30000"
                  min="0"
                  step="100"
                  className="h-7 w-32 text-xs text-right"
                />
                <span className="text-xs text-muted-foreground">万円</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-medium text-foreground">一種単価（参考）</span>
              <span className="text-sm font-bold text-primary">
                {ichishuUnitPrice !== null ? ichishuUnitPrice.toFixed(1) : '--'}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">万円/坪</span>
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              計算式: 土地価格 ÷ (最大延べ面積 ÷ 3.30579)
            </p>
          </div>
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
      {result && (
        <FeasibilitySection
          totalFloorArea={result.maxFloorArea}
          onSnapshotChange={setFeasibilitySnapshot}
        />
      )}

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
        feasibility={feasibilitySnapshot}
      />
    </div>
  );
}
