import { useEffect } from 'react';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';
import { loadProject, saveProject } from '@/lib/project-storage';

interface UseAutoSaveParams {
  site: SiteBoundary | null;
  roads: Road[];
  zoning: ZoningData | null;
  latitude: number;
  floorHeights: number[];
}

export function useAutoSave({ site, roads, zoning, latitude, floorHeights }: UseAutoSaveParams) {
  useEffect(() => {
    if (!site || !zoning || roads.length === 0) return;
    saveProject({ site, roads, zoning, latitude, floorHeights, savedAt: '' });
  }, [site, roads, zoning, latitude, floorHeights]);
}

export { loadProject };
