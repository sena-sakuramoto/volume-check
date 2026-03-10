'use client';

import type { FireDistrict, HeightDistrict, ZoningDistrict } from '@/engine/types';
import { getZoningDefaults } from '@/engine';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/cn';
import {
  DISTRICT_GROUPS,
  FIRE_DISTRICT_OPTIONS,
  HEIGHT_DISTRICT_OPTIONS,
  getDistrictShortLabel,
} from './site-types';

interface ZoningEditorProps {
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
  heightDistrictAutoDetected?: boolean;
  isCornerLot: boolean;
  onCornerLotChange: (v: boolean) => void;
}

export function ZoningEditor({
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
  heightDistrictAutoDetected = false,
  isCornerLot,
  onCornerLotChange,
}: ZoningEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">用途地域</label>
        {DISTRICT_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <span className="block text-[10px] text-muted-foreground/70">{group.label}</span>
            <div className="grid grid-cols-2 gap-1">
              {group.districts.map((district) => {
                const isActive = selectedDistrict === district;
                return (
                  <button
                    key={district}
                    type="button"
                    onClick={() => onDistrictChange(district)}
                    title={district}
                    className={cn(
                      'truncate rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                      isActive ? group.activeBgClass : group.bgClass,
                    )}
                  >
                    {getDistrictShortLabel(district)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedDistrict ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">建ぺい率 (%)</label>
            <Input
              type="number"
              value={coverageOverride}
              onChange={(e) => onCoverageChange(e.target.value)}
              placeholder={String(
                Math.round(getZoningDefaults(selectedDistrict).defaultCoverageRatio * 100),
              )}
              min="0"
              max="100"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">容積率 (%)</label>
            <Input
              type="number"
              value={farOverride}
              onChange={(e) => onFarChange(e.target.value)}
              placeholder={String(
                Math.round(getZoningDefaults(selectedDistrict).defaultFloorAreaRatio * 100),
              )}
              min="0"
              max="1300"
              className="h-9 text-sm"
            />
          </div>
        </div>
      ) : null}

      {selectedDistrict ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">防火指定</label>
          <div className="flex gap-1.5">
            {FIRE_DISTRICT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onFireDistrictChange(option.key)}
                className={cn(
                  'flex-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                  fireDistrict === option.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selectedDistrict ? (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/80 bg-white/70 px-3 py-3">
          <input
            type="checkbox"
            checked={isCornerLot}
            onChange={(e) => onCornerLotChange(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-ring focus:ring-offset-0"
          />
          <span className="text-[11px] text-foreground/85">角地として扱う（建ぺい率 +10%）</span>
        </label>
      ) : null}

      {selectedDistrict ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">高度地区</label>
            {heightDistrictAutoDetected ? (
              <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] text-teal-900">
                自動取得
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {HEIGHT_DISTRICT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onHeightDistrictChange(option.key)}
                className={cn(
                  'rounded-xl px-2 py-2 text-[11px] font-medium transition-colors',
                  heightDistrictType === option.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
