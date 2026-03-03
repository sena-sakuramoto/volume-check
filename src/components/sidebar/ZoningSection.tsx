'use client';

import { AlertTriangle } from 'lucide-react';
import type { ZoningData, ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
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
    <div className="p-4 space-y-3">
      {zoning?.districtPlan && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">地区計画あり</span>
          </div>
          <p className="text-[11px] text-amber-200">{zoning.districtPlan.name}</p>
          {zoning.districtPlan.restrictions && (
            <p className="text-[10px] text-amber-400/70">{zoning.districtPlan.restrictions}</p>
          )}
          {zoning.districtPlan.maxHeight && (
            <p className="text-[10px] text-amber-400/70">
              最高高さ制限: {zoning.districtPlan.maxHeight}m
            </p>
          )}
          <p className="text-[10px] text-amber-400/50 mt-1">
            ※ 地区計画の詳細は管轄自治体にご確認ください
          </p>
        </div>
      )}
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
  );
}
