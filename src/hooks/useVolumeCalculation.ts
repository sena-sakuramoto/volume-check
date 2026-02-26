import { useMemo, useState } from 'react';
import type { SiteBoundary, Road, ZoningData, VolumeResult } from '@/engine/types';
import { generateEnvelope } from '@/engine';

interface UseVolumeCalculationParams {
  site: SiteBoundary | null;
  zoning: ZoningData | null;
  roads: Road[];
  latitude: number;
  floorHeights: number[];
}

export function useVolumeCalculation({ site, zoning, roads, latitude, floorHeights }: UseVolumeCalculationParams) {
  const [calcError, setCalcError] = useState<string | null>(null);

  const volumeResult: VolumeResult | null = useMemo(() => {
    if (!site || !zoning || roads.length === 0) {
      setCalcError(null);
      return null;
    }
    try {
      setCalcError(null);
      return generateEnvelope({ site, zoning, roads, latitude, floorHeights: floorHeights.length > 0 ? floorHeights : undefined });
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : '計算エラーが発生しました');
      return null;
    }
  }, [site, zoning, roads, latitude, floorHeights]);

  const maxFloors = volumeResult?.maxFloors ?? 0;
  const effectiveFloorHeights = useMemo(() => {
    if (maxFloors <= 0) return [];
    if (floorHeights.length === maxFloors) return floorHeights;
    const result: number[] = [];
    for (let i = 0; i < maxFloors; i++) {
      result.push(i < floorHeights.length ? floorHeights[i] : 3.0);
    }
    return result;
  }, [maxFloors, floorHeights]);

  return { volumeResult, calcError, effectiveFloorHeights };
}
