'use client';

import { AlertTriangle } from 'lucide-react';
import type { FireDistrict, HeightDistrict, ZoningData, ZoningDistrict } from '@/engine/types';
import { ZoningEditor } from '@/components/site/ZoningEditor';

interface ZoningSectionProps {
  zoning: ZoningData | null;
  selectedDistrict: ZoningDistrict | null;
  onDistrictChange: (d: ZoningDistrict) => void;
  coverageOverride: string;
  onCoverageChange: (v: string) => void;
  farOverride: string;
  onFarChange: (v: string) => void;
  fireDistrict: FireDistrict;
  onFireDistrictChange: (f: FireDistrict) => void;
  heightDistrictType: HeightDistrict['type'];
  onHeightDistrictChange: (h: HeightDistrict['type']) => void;
  isCornerLot: boolean;
  onCornerLotChange: (v: boolean) => void;
}

export function ZoningSection(props: ZoningSectionProps) {
  const {
    zoning,
    selectedDistrict,
    onDistrictChange,
    coverageOverride,
    onCoverageChange,
    farOverride,
    onFarChange,
    fireDistrict,
    onFireDistrictChange,
    heightDistrictType,
    onHeightDistrictChange,
    isCornerLot,
    onCornerLotChange,
  } = props;

  return (
    <div className="space-y-4 p-4">
      <div className="ui-surface-soft px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          Regulation
        </p>
        <h3 className="mt-2 text-sm font-semibold text-foreground">法規条件を整える</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          用途地域、建ぺい率、容積率、防火指定、高度地区を確認してからボリュームを確定します。
        </p>
      </div>

      {zoning?.districtPlan ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <span className="text-xs font-medium text-amber-900">地区計画あり</span>
          </div>
          <p className="mt-2 text-[11px] text-amber-950">{zoning.districtPlan.name}</p>
          {zoning.districtPlan.restrictions ? (
            <p className="mt-1 text-[10px] text-amber-800/80">{zoning.districtPlan.restrictions}</p>
          ) : null}
          {zoning.districtPlan.maxHeight ? (
            <p className="mt-1 text-[10px] text-amber-800/80">
              最高高さ: {zoning.districtPlan.maxHeight}m
            </p>
          ) : null}
          {zoning.districtPlan.minHeight ? (
            <p className="mt-1 text-[10px] text-amber-800/80">
              最低高さ: {zoning.districtPlan.minHeight}m
            </p>
          ) : null}
          {zoning.districtPlan.wallSetback ? (
            <p className="mt-1 text-[10px] text-amber-800/80">
              壁面後退: {zoning.districtPlan.wallSetback}m
            </p>
          ) : null}
          {zoning.districtPlan.coverageRatio ? (
            <p className="mt-1 text-[10px] text-amber-800/80">
              建ぺい率: {(zoning.districtPlan.coverageRatio * 100).toFixed(0)}%
            </p>
          ) : null}
          {zoning.districtPlan.floorAreaRatio ? (
            <p className="mt-1 text-[10px] text-amber-800/80">
              容積率: {(zoning.districtPlan.floorAreaRatio * 100).toFixed(0)}%
            </p>
          ) : null}
          <p className="mt-2 text-[10px] text-amber-700/80">
            数値制限は計算に反映しています。本文の細かい運用は、役所協議や確認申請の前に別途確認してください。
          </p>
        </div>
      ) : null}

      <div className="ui-surface px-4 py-4">
        <ZoningEditor
          selectedDistrict={selectedDistrict}
          onDistrictChange={onDistrictChange}
          coverageOverride={coverageOverride}
          onCoverageChange={onCoverageChange}
          farOverride={farOverride}
          onFarChange={onFarChange}
          fireDistrict={fireDistrict}
          onFireDistrictChange={onFireDistrictChange}
          heightDistrictType={heightDistrictType}
          onHeightDistrictChange={onHeightDistrictChange}
          isCornerLot={isCornerLot}
          onCornerLotChange={onCornerLotChange}
          heightDistrictAutoDetected={zoning?.heightDistrict.autoDetected === true}
        />
      </div>
    </div>
  );
}
