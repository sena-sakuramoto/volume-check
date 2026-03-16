import { useEffect } from 'react';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';
import type { RoadConfig, SitePrecision } from '@/components/site/site-types';
import { loadProject, saveProject } from '@/lib/project-storage';

interface UseAutoSaveParams {
  site: SiteBoundary | null;
  roads: Road[];
  zoning: ZoningData | null;
  latitude: number;
  floorHeights: number[];
  roadConfigs: RoadConfig[];
  sitePrecision: SitePrecision;
}

export function useAutoSave({
  site,
  roads,
  zoning,
  latitude,
  floorHeights,
  roadConfigs,
  sitePrecision,
}: UseAutoSaveParams) {
  useEffect(() => {
    if (!site || !zoning || roads.length === 0) return;
    saveProject({ site, roads, zoning, latitude, floorHeights, roadConfigs, sitePrecision, savedAt: '' });
  }, [site, roads, zoning, latitude, floorHeights, roadConfigs, sitePrecision]);
}

export { loadProject };
