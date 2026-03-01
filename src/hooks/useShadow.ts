import { useMemo } from 'react';
import type { SiteBoundary, ZoningData, VolumeResult } from '@/engine/types';
import { getShadowMaskAtTime } from '@/engine';

interface UseShadowParams {
  shadowTimeValue: number;
  volumeResult: VolumeResult | null;
  site: SiteBoundary | null;
  zoning: ZoningData | null;
  latitude: number;
  showTimeShadow: boolean;
}

export function useShadow({ shadowTimeValue, volumeResult, site, zoning, latitude, showTimeShadow }: UseShadowParams) {
  const shadowTime = useMemo(() => {
    const totalMinutes = 8 * 60 + shadowTimeValue;
    return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
  }, [shadowTimeValue]);

  const shadowMask = useMemo(() => {
    if (!volumeResult?.heightFieldData || !site || !zoning?.shadowRegulation) return null;
    if (!showTimeShadow) return null;
    try {
      const maskResult = getShadowMaskAtTime(
        volumeResult.heightFieldData,
        site.vertices,
        zoning.shadowRegulation.measurementHeight,
        latitude,
        0,
        shadowTime.hour,
        shadowTime.minute,
      );
      return maskResult.mask;
    } catch {
      return null;
    }
  }, [volumeResult, site, zoning, latitude, showTimeShadow, shadowTime]);

  return { shadowTime, shadowMask };
}
