import type {
  FireDistrict,
  HeightDistrict,
  Road,
  SiteBoundary,
  ZoningData,
  ZoningDistrict,
} from '@/engine/types';

function toRecord<K extends string, V>(entries: readonly (readonly [K, V])[]): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}

/** Analyze-site API response type */
export interface AnalyzeSiteResponse {
  type?: string;
  address?: string | null;
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
    confidence?: RoadConfidence;
    reasoning?: string;
    sourceLabel?: string;
    sourceDetail?: string;
  }[];
  zoning?: {
    district?: string | null;
    coverageRatio?: number | null;
    floorAreaRatio?: number | null;
    fireDistrict?: string | null;
  };
  surroundings?: {
    roads?: string[];
    rivers?: string[];
  };
  confidence?: RoadConfidence;
  notes?: string;
  error?: string;
  validationErrors?: string[];
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
export type RoadSource = 'manual' | 'api' | 'ai' | 'demo';
export type RoadReviewStatus = 'confirmed' | 'suggested';
export type RoadConfidence = 'high' | 'medium' | 'low';
export type OppositeOpenSpaceKind =
  | 'none'
  | 'alley'
  | 'waterway'
  | 'river'
  | 'railway'
  | 'park'
  | 'plaza';

export interface RoadCandidate {
  width: number;
  direction: RoadDirection;
  edgeVertexIndices?: [number, number];
  source?: RoadSource;
  confidence?: RoadConfidence;
  reasoning?: string;
  sourceLabel?: string;
  sourceDetail?: string;
  distance?: number | null;
  name?: string;
  highway?: string;
  frontSetback?: number;
  oppositeSideSetback?: number;
  oppositeOpenSpace?: number;
  oppositeOpenSpaceKind?: OppositeOpenSpaceKind;
  slopeWidthOverride?: number;
  siteHeightAboveRoad?: number;
  enableTwoA35m?: boolean;
}

export interface RoadConfig {
  id: string;
  width: number;
  direction: RoadDirection;
  customWidth: string;
  /** Explicit boundary edge indices [start, end] for polygon sites. */
  edgeVertexIndices?: [number, number];
  source?: RoadSource;
  reviewStatus?: RoadReviewStatus;
  confidence?: RoadConfidence;
  reasoning?: string;
  sourceLabel?: string;
  sourceDetail?: string;
  distance?: number | null;
  name?: string;
  highway?: string;
  frontSetback?: number;
  oppositeSideSetback?: number;
  oppositeOpenSpace?: number;
  oppositeOpenSpaceKind?: OppositeOpenSpaceKind;
  slopeWidthOverride?: number;
  siteHeightAboveRoad?: number;
  enableTwoA35m?: boolean;
}

const DISTRICT_ENTRIES = [
  ['第一種低層住居専用地域', '第一種低層住居専用地域'],
  ['第二種低層住居専用地域', '第二種低層住居専用地域'],
  ['第一種中高層住居専用地域', '第一種中高層住居専用地域'],
  ['第二種中高層住居専用地域', '第二種中高層住居専用地域'],
  ['第一種住居地域', '第一種住居地域'],
  ['第二種住居地域', '第二種住居地域'],
  ['準住居地域', '準住居地域'],
  ['田園住居地域', '田園住居地域'],
  ['近隣商業地域', '近隣商業地域'],
  ['商業地域', '商業地域'],
  ['準工業地域', '準工業地域'],
  ['工業地域', '工業地域'],
  ['工業専用地域', '工業専用地域'],
] as const satisfies readonly (readonly [ZoningDistrict, string])[];

const DISTRICT_SHORT_ENTRIES = [
  ['第一種低層住居専用地域', '第一種低層'],
  ['第二種低層住居専用地域', '第二種低層'],
  ['第一種中高層住居専用地域', '第一種中高'],
  ['第二種中高層住居専用地域', '第二種中高'],
  ['第一種住居地域', '第一種住居'],
  ['第二種住居地域', '第二種住居'],
  ['準住居地域', '準住居'],
  ['田園住居地域', '田園住居'],
  ['近隣商業地域', '近隣商業'],
  ['商業地域', '商業'],
  ['準工業地域', '準工業'],
  ['工業地域', '工業'],
  ['工業専用地域', '工専'],
] as const satisfies readonly (readonly [ZoningDistrict, string])[];

const FIRE_DISTRICT_ENTRIES = [
  ['指定なし', '指定なし'],
  ['準防火地域', '準防火地域'],
  ['防火地域', '防火地域'],
] as const satisfies readonly (readonly [FireDistrict, string])[];

const HEIGHT_DISTRICT_ENTRIES = [
  ['指定なし', '指定なし'],
  ['第一種', '第一種高度地区'],
  ['第二種', '第二種高度地区'],
  ['第三種', '第三種高度地区'],
] as const satisfies readonly (readonly [HeightDistrict['type'], string])[];

export const DISTRICT_LABELS = toRecord(DISTRICT_ENTRIES);
export const DISTRICT_SHORT_LABELS = toRecord(DISTRICT_SHORT_ENTRIES);
export const FIRE_DISTRICT_LABELS = toRecord(FIRE_DISTRICT_ENTRIES);
export const HEIGHT_DISTRICT_LABELS = toRecord(HEIGHT_DISTRICT_ENTRIES);

export const ROAD_WIDTH_PRESETS = [4, 6, 8] as const;

export const ROAD_DIRECTION_OPTIONS: { key: RoadDirection; label: string; bearing: number }[] = [
  { key: 'south', label: '南側', bearing: 180 },
  { key: 'east', label: '東側', bearing: 90 },
  { key: 'west', label: '西側', bearing: 270 },
  { key: 'north', label: '北側', bearing: 0 },
];

export const FIRE_DISTRICT_OPTIONS = FIRE_DISTRICT_ENTRIES.map(([key, label]) => ({ key, label }));
export const HEIGHT_DISTRICT_OPTIONS = HEIGHT_DISTRICT_ENTRIES.map(([key, label]) => ({ key, label }));

export const OPPOSITE_OPEN_SPACE_OPTIONS: Array<{
  key: OppositeOpenSpaceKind;
  label: string;
  hint: string;
}> = [
  { key: 'none', label: 'なし', hint: '通常の前面道路として扱います。' },
  { key: 'park', label: '公園', hint: '公園が反対側に連続する場合は道路斜線の扱いを再確認してください。' },
  { key: 'plaza', label: '広場', hint: '広場状の空地は対側空地として扱える場合があります。' },
  { key: 'river', label: '河川', hint: '河川や河川管理通路は道路斜線の緩和対象になることがあります。' },
  { key: 'waterway', label: '水路', hint: '水路や暗渠上の通路は扱いが分かれるため、所管行政庁で確認が必要です。' },
  { key: 'railway', label: '線路敷', hint: '線路敷は対側空地として見込める場合があります。' },
  { key: 'alley', label: '里道など', hint: '里道や細街路は幅員扱いと対側空地の両方を確認してください。' },
];

export interface DistrictGroup {
  label: string;
  bgClass: string;
  activeBgClass: string;
  districts: ZoningDistrict[];
}

const RESIDENTIAL_DISTRICTS = DISTRICT_ENTRIES.slice(0, 8).map(([district]) => district);
const COMMERCIAL_DISTRICTS = DISTRICT_ENTRIES.slice(8, 10).map(([district]) => district);
const INDUSTRIAL_DISTRICTS = DISTRICT_ENTRIES.slice(10).map(([district]) => district);

export const DISTRICT_GROUPS: DistrictGroup[] = [
  {
    label: '住居系',
    bgClass: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
    activeBgClass: 'bg-emerald-700 text-white',
    districts: RESIDENTIAL_DISTRICTS,
  },
  {
    label: '商業系',
    bgClass: 'bg-amber-50 text-amber-950 hover:bg-amber-100',
    activeBgClass: 'bg-amber-600 text-white',
    districts: COMMERCIAL_DISTRICTS,
  },
  {
    label: '工業系',
    bgClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    activeBgClass: 'bg-slate-600 text-white',
    districts: INDUSTRIAL_DISTRICTS,
  },
];

export const ALL_DISTRICTS: ZoningDistrict[] = DISTRICT_ENTRIES.map(([district]) => district);

export function getDistrictLabel(district: ZoningDistrict | null | undefined): string {
  if (!district) return '未設定';
  return DISTRICT_LABELS[district] ?? district;
}

export function getDistrictShortLabel(district: ZoningDistrict | null | undefined): string {
  if (!district) return '未設定';
  return DISTRICT_SHORT_LABELS[district] ?? getDistrictLabel(district);
}

export function getFireDistrictLabel(district: FireDistrict | null | undefined): string {
  if (!district) return '未設定';
  return FIRE_DISTRICT_LABELS[district] ?? district;
}

export function getHeightDistrictLabel(type: HeightDistrict['type'] | null | undefined): string {
  if (!type) return '未設定';
  return HEIGHT_DISTRICT_LABELS[type] ?? type;
}

export function getRoadDirectionLabel(direction: RoadDirection): string {
  return ROAD_DIRECTION_OPTIONS.find((option) => option.key === direction)?.label ?? direction;
}

export function getOppositeOpenSpaceLabel(kind: OppositeOpenSpaceKind | null | undefined): string {
  if (!kind) return '未設定';
  return OPPOSITE_OPEN_SPACE_OPTIONS.find((option) => option.key === kind)?.label ?? kind;
}

/** Shared props for site sub-components that can trigger parent state changes */
export interface SiteCallbacks {
  onSiteChange: (site: SiteBoundary) => void;
  onRoadsChange: (
    roads: Road[],
    options?: {
      source?: RoadSource;
      candidates?: RoadCandidate[];
      message?: string | null;
    },
  ) => void;
  onZoningChange: (zoning: ZoningData) => void;
  onLatitudeChange: (lat: number) => void;
}
