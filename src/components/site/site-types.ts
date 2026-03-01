import type {
  SiteBoundary,
  Road,
  ZoningData,
  ZoningDistrict,
} from '@/engine/types';

/** Analyze-site API response type */
export interface AnalyzeSiteResponse {
  type?: string;
  site?: {
    vertices?: { x: number; y: number }[];
    area?: number;
    frontageWidth?: number;
    depth?: number;
  };
  roads?: {
    direction?: string;
    width?: number;
    edgeVertexIndices?: [number, number];
  }[];
  zoning?: {
    district?: string | null;
    coverageRatio?: number | null;
    floorAreaRatio?: number | null;
    fireDistrict?: string | null;
  };
  confidence?: string;
  notes?: string;
  error?: string;
}

export type UploadStatus =
  | { state: 'idle' }
  | { state: 'uploading' }
  | { state: 'success'; notes: string }
  | { state: 'error'; message: string };

export type SearchStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'geocoded'; address: string; lat: number; lng: number }
  | { state: 'zoning-loading'; address: string; lat: number; lng: number }
  | { state: 'success'; address: string; district: ZoningDistrict; siteDetected?: boolean }
  | { state: 'zoning-not-found'; address: string }
  | { state: 'error'; message: string };

export type RoadDirection = 'south' | 'north' | 'east' | 'west';

export interface RoadConfig {
  id: string;
  width: number;
  direction: RoadDirection;
  customWidth: string;
}

export const ROAD_WIDTH_PRESETS = [4, 6, 8] as const;

export const ROAD_DIRECTION_OPTIONS: { key: RoadDirection; label: string; bearing: number }[] = [
  { key: 'south', label: '南', bearing: 180 },
  { key: 'east', label: '東', bearing: 90 },
  { key: 'west', label: '西', bearing: 270 },
  { key: 'north', label: '北', bearing: 0 },
];

export interface DistrictGroup {
  label: string;
  bgClass: string;
  activeBgClass: string;
  districts: ZoningDistrict[];
}

export const DISTRICT_GROUPS: DistrictGroup[] = [
  {
    label: '住居系',
    bgClass: 'bg-emerald-900/30 text-emerald-200 hover:bg-emerald-800/50',
    activeBgClass: 'bg-emerald-500 text-black',
    districts: [
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
      '田園住居地域',
    ],
  },
  {
    label: '商業系',
    bgClass: 'bg-amber-900/30 text-amber-200 hover:bg-amber-800/50',
    activeBgClass: 'bg-amber-500 text-black',
    districts: ['近隣商業地域', '商業地域'],
  },
  {
    label: '工業系',
    bgClass: 'bg-slate-800/50 text-slate-200 hover:bg-slate-700/50',
    activeBgClass: 'bg-slate-500 text-white',
    districts: ['準工業地域', '工業地域', '工業専用地域'],
  },
];

export const ALL_DISTRICTS: ZoningDistrict[] = DISTRICT_GROUPS.flatMap((g) => g.districts);

/** Shared props for site sub-components that can trigger parent state changes */
export interface SiteCallbacks {
  onSiteChange: (site: SiteBoundary) => void;
  onRoadsChange: (roads: Road[]) => void;
  onZoningChange: (zoning: ZoningData) => void;
  onLatitudeChange: (lat: number) => void;
}
