'use client';

import { useState } from 'react';
import type { Road, SiteBoundary, VolumeResult, ZoningData } from '@/engine/types';
import {
  getAdjacentSetbackParams,
  getNorthSetbackParams,
  getRoadFloorAreaReferenceWidth,
  getRoadRequiredFrontSetback,
  getRoadSetbackParams,
  getRoadSlopeEffectiveWidth,
  isResidentialZone,
} from '@/engine';
import { MAX_HEIGHT_CAP } from '@/engine/constants';
import { ActionToolbar } from '@/components/results/ActionToolbar';
import {
  FeasibilitySection,
  type FeasibilitySnapshot,
} from '@/components/results/FeasibilitySection';
import { FloorTable } from '@/components/results/FloorTable';
import { HeroMetrics } from '@/components/results/HeroMetrics';
import { PatternComparison } from '@/components/results/PatternComparison';
import { FloorEditor } from '@/components/ui/FloorEditor';
import { Input } from '@/components/ui/shadcn/input';
import {
  getDistrictLabel,
  getFireDistrictLabel,
  getHeightDistrictLabel,
  getOppositeOpenSpaceLabel,
} from '@/components/site/site-types';

function SectionFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-surface space-y-3 px-4 py-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function LabelValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white/72 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

function ValueTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white/78 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-2 font-display text-xl font-semibold leading-none text-foreground">
        {value}
        {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
      </div>
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

  if (!zoning) {
    return (
      <div className="space-y-4 p-4">
        <SectionFrame
          eyebrow="Ready"
          title="結果はここに表示されます"
          description="敷地入力と法規設定が終わると、最大ボリュームと事業性の概算をまとめて確認できます。"
        >
          <div className="rounded-xl border border-dashed border-border bg-white/55 px-4 py-6 text-center text-[12px] text-muted-foreground">
            まずは敷地入力と法規設定を完了してください。
          </div>
        </SectionFrame>
      </div>
    );
  }

  const roadParams = getRoadSetbackParams(zoning.district);
  const adjacentParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);
  const roadBasedMultiplier = isResidentialZone(zoning.district) ? 0.4 : 0.6;
  const roadBasedFar = roads.length > 0
    ? Math.min(
        zoning.floorAreaRatio,
        Math.max(...roads.map((road) => getRoadFloorAreaReferenceWidth(road))) * roadBasedMultiplier,
      )
    : zoning.floorAreaRatio;

  const roadAdjustmentSummary = roads
    .map((road, index) => {
      const parts: string[] = [];
      const frontSetback = getRoadRequiredFrontSetback(road);
      if (frontSetback > 0) parts.push(`前面後退 ${frontSetback.toFixed(2)}m`);
      if ((road.oppositeSideSetback ?? 0) > 0) {
        parts.push(`対側後退 ${(road.oppositeSideSetback ?? 0).toFixed(2)}m`);
      }
      if ((road.oppositeOpenSpace ?? 0) > 0) {
        parts.push(`対側空地 ${(road.oppositeOpenSpace ?? 0).toFixed(2)}m`);
      }
      if (road.oppositeOpenSpaceKind && road.oppositeOpenSpaceKind !== 'none') {
        parts.push(`種別 ${getOppositeOpenSpaceLabel(road.oppositeOpenSpaceKind)}`);
      }
      if ((road.slopeWidthOverride ?? 0) > 0) {
        parts.push(`斜線基準幅 ${getRoadSlopeEffectiveWidth(road).toFixed(2)}m`);
      }
      if ((road.siteHeightAboveRoad ?? 0) !== 0) {
        parts.push(`高低差 ${(road.siteHeightAboveRoad ?? 0).toFixed(2)}m`);
      }
      if (road.enableTwoA35m === true) {
        parts.push('2A / 35m');
      }
      if (parts.length === 0) return null;
      return { label: `道路 ${index + 1} の補正`, value: parts.join(' / ') };
    })
    .filter((item): item is { label: string; value: string } => item !== null);

  const landPrice = Number.parseFloat(landPriceInput);
  const floorAreaTsubo = result ? result.maxFloorArea / 3.30579 : 0;
  const unitLandPrice =
    result && Number.isFinite(landPrice) && landPrice > 0 && floorAreaTsubo > 0
      ? landPrice / floorAreaTsubo
      : null;

  return (
    <div className="space-y-4 p-4">
      {result ? <HeroMetrics result={result} /> : null}

      <SectionFrame
        eyebrow="Regulation"
        title="法規サマリー"
        description="現在の設定値を一度に確認できます。自動取得のあとでも手で上書きできます。"
      >
        <div className="grid grid-cols-1 gap-2">
          <LabelValue label="用途地域" value={getDistrictLabel(zoning.district)} />
          <LabelValue label="建ぺい率" value={`${Math.round(zoning.coverageRatio * 100)}%`} />
          <LabelValue label="容積率" value={`${Math.round(zoning.floorAreaRatio * 100)}%`} />
          <LabelValue label="防火指定" value={getFireDistrictLabel(zoning.fireDistrict)} />
          <LabelValue label="高度地区" value={getHeightDistrictLabel(zoning.heightDistrict?.type)} />
          <LabelValue
            label="絶対高さ"
            value={zoning.absoluteHeightLimit !== null ? `${zoning.absoluteHeightLimit}m` : '指定なし'}
          />
          <LabelValue
            label="壁面後退"
            value={zoning.wallSetback !== null ? `${zoning.wallSetback}m` : '指定なし'}
          />
          {site ? <LabelValue label="敷地面積" value={`${site.area.toFixed(2)}m²`} /> : null}
          {zoning.isCornerLot ? <LabelValue label="角地" value="あり" /> : null}
        </div>
      </SectionFrame>

      <SectionFrame
        eyebrow="Envelope"
        title="斜線と高さの前提"
        description="包絡体の計算に使っている主要な条件です。"
      >
        <div className="grid grid-cols-1 gap-2">
          <LabelValue label="道路斜線" value={`1 : ${roadParams.slopeRatio}`} />
          {roadParams.applicationDistance !== Infinity ? (
            <LabelValue label="道路斜線の適用距離" value={`${roadParams.applicationDistance}m`} />
          ) : null}
          <LabelValue
            label="隣地斜線"
            value={`${adjacentParams.riseHeight}m + ${adjacentParams.slopeRatio}D`}
          />
          {northParams ? (
            <LabelValue
              label="北側斜線"
              value={`${northParams.riseHeight}m + ${northParams.slopeRatio}D`}
            />
          ) : null}
          {roads.length > 0 ? (
            <LabelValue
              label="道路幅員による容積率"
              value={`${Math.round(roadBasedFar * 100)}%`}
            />
          ) : null}
          {roadAdjustmentSummary.map((item) => (
            <LabelValue key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </SectionFrame>

      {result ? (
        <SectionFrame
          eyebrow="Volume"
          title="ボリューム結果"
          description="土地価格を入れると、坪単価の目安まで確認できます。"
        >
          <div className="rounded-xl border border-border/70 bg-white/78 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">土地価格</span>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={landPriceInput}
                  onChange={(event) => setLandPriceInput(event.target.value)}
                  placeholder="例 30000"
                  min="0"
                  step="100"
                  className="h-8 w-32 text-right text-xs"
                />
                <span className="text-[11px] text-muted-foreground">万円</span>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              坪単価 = 土地価格 ÷ 最大延床面積（坪）
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ValueTile label="延床面積" value={result.maxFloorArea.toFixed(0)} unit="m²" />
            <ValueTile label="建築面積" value={result.maxCoverageArea.toFixed(0)} unit="m²" />
            <ValueTile
              label="最高高さ"
              value={Number.isFinite(result.maxHeight) ? result.maxHeight.toFixed(1) : '--'}
              unit={Number.isFinite(result.maxHeight) ? 'm' : undefined}
            />
            <ValueTile label="階数" value={`${result.maxFloors}`} unit="F" />
            <ValueTile
              label="土地坪単価"
              value={unitLandPrice !== null ? unitLandPrice.toFixed(1) : '--'}
              unit={unitLandPrice !== null ? '万円 / 坪' : undefined}
            />
            <ValueTile label="解析上限" value={MAX_HEIGHT_CAP.toFixed(0)} unit="m" />
          </div>
        </SectionFrame>
      ) : null}

      {result ? (
        <div className="ui-surface px-4 py-4">
          <FeasibilitySection
            totalFloorArea={result.maxFloorArea}
            onSnapshotChange={setFeasibilitySnapshot}
          />
        </div>
      ) : null}

      {result?.buildingPatterns ? (
        <div className="ui-surface px-4 py-4">
          <PatternComparison patterns={result.buildingPatterns} />
        </div>
      ) : result ? (
        <SectionFrame
          eyebrow="Pattern"
          title="建物パターン比較"
          description="日影規制が有効な場合は、低層・中層・最大案を比較します。"
        >
          <div className="rounded-xl border border-dashed border-border bg-white/60 px-4 py-4 text-[11px] text-muted-foreground">
            この条件では建物パターン比較を表示できませんでした。
          </div>
        </SectionFrame>
      ) : null}

      {result ? (
        <div className="ui-surface px-4 py-4">
          <FloorEditor
            maxFloors={result.maxFloors}
            maxHeight={result.maxHeight}
            floorHeights={floorHeights}
            onFloorHeightsChange={onFloorHeightsChange}
          />
        </div>
      ) : null}

      {result ? (
        <div className="ui-surface px-4 py-4">
          <FloorTable floorHeights={floorHeights} maxHeight={result.maxHeight} />
        </div>
      ) : null}

      {result ? (
        <SectionFrame
          eyebrow="Assumption"
          title="計算前提"
          description="レポート出力前に、計算の前提だけここで確認できます。"
        >
          <div className="space-y-2 rounded-xl border border-border/70 bg-white/72 px-3 py-3 text-[11px] text-muted-foreground">
            <p>日影は冬至日の 8:00 から 16:00 を 10 分刻みで評価しています。</p>
            <p>解析上限高さは {MAX_HEIGHT_CAP.toFixed(0)}m です。</p>
            <p>パターン比較は日影規制が有効な場合のみ最大高さを再探索しています。</p>
          </div>
        </SectionFrame>
      ) : null}

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
