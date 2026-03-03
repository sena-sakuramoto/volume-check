import type { SiteBoundary, Road, ZoningData } from '@/engine/types';

const STORAGE_KEY = 'volumecheck_project';

export interface ProjectData {
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  latitude: number;
  floorHeights: number[];
  savedAt: string;
}

/**
 * プロジェクトデータを localStorage に保存する。
 * savedAt は現在時刻の ISO 文字列で自動的に上書きされる。
 */
export function saveProject(data: ProjectData): void {
  const payload: ProjectData = {
    ...data,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    console.error('プロジェクトの保存に失敗しました。');
  }
}

/**
 * localStorage からプロジェクトデータを読み込む。
 * データが存在しない、またはパースに失敗した場合は null を返す。
 */
export function loadProject(): ProjectData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectData;
    return {
      ...parsed,
      zoning: {
        ...parsed.zoning,
        districtPlan: parsed.zoning.districtPlan ?? null,
      },
    };
  } catch {
    console.error('プロジェクトの読み込みに失敗しました。');
    return null;
  }
}
