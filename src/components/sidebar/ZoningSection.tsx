'use client';

import type { ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
import { ZoningEditor } from '@/components/site/ZoningEditor';

interface ZoningSectionProps {
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
  return (
    <div className="p-4">
      <ZoningEditor {...props} />
    </div>
  );
}
