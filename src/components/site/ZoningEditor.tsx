'use client';

import type { ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
import { getZoningDefaults } from '@/engine';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/cn';
import { DISTRICT_GROUPS } from './site-types';
import { shortenDistrict } from './site-helpers';

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
  isCornerLot,
  onCornerLotChange,
}: ZoningEditorProps) {
  return (
    <div className="space-y-3">
      {/* District selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">用途地域</label>
        {DISTRICT_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <span className="block text-[10px] text-muted-foreground/70">{group.label}</span>
            <div className="grid grid-cols-2 gap-0.5">
              {group.districts.map((district) => {
                const isActive = selectedDistrict === district;
                return (
                  <button
                    key={district}
                    onClick={() => onDistrictChange(district)}
                    title={district}
                    className={cn(
                      'rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors truncate',
                      isActive ? group.activeBgClass : group.bgClass,
                    )}
                  >
                    {shortenDistrict(district)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Coverage + FAR overrides */}
      {selectedDistrict && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">建ぺい率 (%)</label>
            <Input
              type="number"
              value={coverageOverride}
              onChange={(e) => onCoverageChange(e.target.value)}
              placeholder={String(Math.round(getZoningDefaults(selectedDistrict).defaultCoverageRatio * 100))}
              min="0"
              max="100"
              className="h-7 text-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-0.5">容積率 (%)</label>
            <Input
              type="number"
              value={farOverride}
              onChange={(e) => onFarChange(e.target.value)}
              placeholder={String(Math.round(getZoningDefaults(selectedDistrict).defaultFloorAreaRatio * 100))}
              min="0"
              max="1300"
              className="h-7 text-xs"
            />
          </div>
        </div>
      )}

      {/* Fire district */}
      {selectedDistrict && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">防火地域</label>
          <div className="flex gap-1">
            {(['指定なし', '準防火地域', '防火地域'] as FireDistrict[]).map((fd) => (
              <button
                key={fd}
                onClick={() => onFireDistrictChange(fd)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  fireDistrict === fd
                    ? 'bg-red-600/80 text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {fd === '指定なし' ? 'なし' : fd.replace('地域', '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Corner lot */}
      {selectedDistrict && (
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isCornerLot}
            onChange={(e) => onCornerLotChange(e.target.checked)}
            className="rounded border-border bg-input text-primary focus:ring-ring focus:ring-offset-0 w-3.5 h-3.5"
          />
          <span className="text-[10px] text-foreground/80">角地 (建ぺい率+10%)</span>
        </label>
      )}

      {/* Height district */}
      {selectedDistrict && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">高度地区</label>
          <div className="flex gap-1">
            {(['指定なし', '第一種', '第二種', '第三種'] as HeightDistrict['type'][]).map((hd) => (
              <button
                key={hd}
                onClick={() => onHeightDistrictChange(hd)}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors',
                  heightDistrictType === hd
                    ? 'bg-purple-600/80 text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                )}
              >
                {hd === '指定なし' ? 'なし' : hd}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
