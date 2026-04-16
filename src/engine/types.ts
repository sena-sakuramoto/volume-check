/** 2D point in meters (local coordinate system, origin = site centroid) */
export interface Point2D {
  x: number;
  y: number;
}

/** 3D point in meters */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Site boundary as ordered polygon vertices (clockwise from above) */
export interface SiteBoundary {
  vertices: Point2D[];
  /** Total site area in m² */
  area: number;
}

/** Road adjacent to the site */
export interface Road {
  /** Road edge as line segment on site boundary */
  edgeStart: Point2D;
  edgeEnd: Point2D;
  /** Road width in meters */
  width: number;
  /** Road center line offset from site boundary */
  centerOffset: number;
  /** Direction the road faces (compass bearing, 0=N, 90=E, 180=S, 270=W) */
  bearing: number;
}

/** 13 zoning districts (用途地域) per Building Standards Act */
export type ZoningDistrict =
  | '第一種低層住居専用地域'
  | '第二種低層住居専用地域'
  | '第一種中高層住居専用地域'
  | '第二種中高層住居専用地域'
  | '第一種住居地域'
  | '第二種住居地域'
  | '準住居地域'
  | '田園住居地域'
  | '近隣商業地域'
  | '商業地域'
  | '準工業地域'
  | '工業地域'
  | '工業専用地域';

/** Fire prevention district */
export type FireDistrict = '防火地域' | '準防火地域' | '指定なし';

/** Height district (高度地区) */
export interface HeightDistrict {
  type: '第一種' | '第二種' | '第三種' | '指定なし';
  /** Max height at boundary (overrides default) */
  maxHeightAtBoundary?: number;
  /** Slope ratio (overrides default) */
  slopeRatio?: number;
  /** Absolute max height (overrides default) */
  absoluteMax?: number;
  /** Automatically detected from external dataset */
  autoDetected?: boolean;
}

/** 地区計画情報（ある場合） */
export interface DistrictPlanInfo {
  /** 地区計画の名称 */
  name: string;
  /** 制限内容（テキスト） */
  restrictions?: string;
  /** 最高高さ制限（m）（地区計画による上乗せ） */
  maxHeight?: number;
  /** 最低高さ制限（m） */
  minHeight?: number;
  /** 壁面後退（m）（地区計画による上乗せ） */
  wallSetback?: number;
  /** 容積率上限（地区計画による上乗せ、0-1） */
  floorAreaRatio?: number;
  /** 建ぺい率上限（地区計画による上乗せ、0-1） */
  coverageRatio?: number;
}

/** Shadow regulation parameters (日影規制) */
export interface ShadowRegulation {
  /** Measurement height above ground in meters (1.5m or 4m or 6.5m) */
  measurementHeight: number;
  /** Max shadow hours at 5m line */
  maxHoursAt5m: number;
  /** Max shadow hours at 10m line */
  maxHoursAt10m: number;
}

/** Zoning regulation data for a site */
export interface ZoningData {
  district: ZoningDistrict;
  fireDistrict: FireDistrict;
  heightDistrict: HeightDistrict;
  /** Building coverage ratio (建ぺい率) as decimal, e.g. 0.6 = 60% */
  coverageRatio: number;
  /** Floor area ratio (容積率) as decimal, e.g. 2.0 = 200% */
  floorAreaRatio: number;
  /** Absolute height limit in meters (10m or 12m for low-rise residential) */
  absoluteHeightLimit: number | null;
  /** Wall setback distance in meters (外壁後退) */
  wallSetback: number | null;
  /** Shadow regulation parameters */
  shadowRegulation: ShadowRegulation | null;
  /** Whether the site is a corner lot (角地) */
  isCornerLot: boolean;
  /** 地区計画（PLATEAU urf から取得、あれば） */
  districtPlan: DistrictPlanInfo | null;
}

/** Road setback calculation parameters */
export interface RoadSetbackParams {
  /** Slope ratio (1.25 or 1.5) */
  slopeRatio: number;
  /** Application distance in meters */
  applicationDistance: number;
  /** Setback distance from road boundary */
  setbackDistance: number;
}

/** Adjacent land setback parameters */
export interface AdjacentSetbackParams {
  /** Rise height in meters (20m or 31m) */
  riseHeight: number;
  /** Slope ratio (1.25 or 2.5) */
  slopeRatio: number;
}

/** North side setback parameters */
export interface NorthSetbackParams {
  /** Rise height in meters (5m or 10m) */
  riseHeight: number;
  /** Slope ratio (always 1.25) */
  slopeRatio: number;
}

/** Complete input for volume calculation */
export interface VolumeInput {
  site: SiteBoundary;
  zoning: ZoningData;
  roads: Road[];
  /** Latitude for shadow calculation (sun position) */
  latitude: number;
  /** Optional per-floor heights in meters. If provided, maxFloors is calculated from these. */
  floorHeights?: number[];
}

/** Result of volume calculation */
export interface VolumeResult {
  /** Maximum buildable floor area in m² */
  maxFloorArea: number;
  /** Maximum building coverage area in m² */
  maxCoverageArea: number;
  /** Maximum building height in meters */
  maxHeight: number;
  /** Estimated maximum floors */
  maxFloors: number;
  /** Envelope vertices for 3D rendering (indexed triangles) */
  envelopeVertices: Float32Array;
  envelopeIndices: Uint32Array;
  /** Individual setback envelope data for layer toggling */
  setbackEnvelopes: {
    road: { vertices: Float32Array; indices: Uint32Array } | null;
    adjacent: { vertices: Float32Array; indices: Uint32Array } | null;
    north: { vertices: Float32Array; indices: Uint32Array } | null;
    absoluteHeight: { vertices: Float32Array; indices: Uint32Array } | null;
    shadow: { vertices: Float32Array; indices: Uint32Array } | null;
  };
  /** Binding zone envelopes — shows only where this restriction is the most restrictive */
  bindingZoneEnvelopes: {
    road: { vertices: Float32Array; indices: Uint32Array } | null;
    adjacent: { vertices: Float32Array; indices: Uint32Array } | null;
    north: { vertices: Float32Array; indices: Uint32Array } | null;
    absoluteHeight: { vertices: Float32Array; indices: Uint32Array } | null;
    shadow: { vertices: Float32Array; indices: Uint32Array } | null;
  };
  /** Shadow projection data for ground plane visualization (日影投影) */
  shadowProjection: ShadowProjectionResult | null;
  /** Height field data for time-specific shadow computation */
  heightFieldData: HeightFieldData | null;
  /** Reverse shadow analysis (逆日影) - height contours from shadow regulation */
  reverseShadow: ReverseShadowResult | null;
  /** Building pattern comparison (建物パターン比較) */
  buildingPatterns: BuildingPatternResult | null;
  /** Buildable polygon after wall setback (外壁後退後の建築可能エリア) */
  buildablePolygon: Point2D[] | null;
}

/** Design proposal for compliance checking */
export interface DesignProposal {
  /** Building footprint as polygon vertices */
  footprint: Point2D[];
  /** Building height in meters */
  height: number;
  /** Number of floors */
  floors: number;
  /** Per-floor heights (optional, defaults to equal) */
  floorHeights?: number[];
}

/** Compliance check result */
export interface ComplianceResult {
  isCompliant: boolean;
  violations: Violation[];
}

export interface Violation {
  type:
    | 'road_setback'
    | 'adjacent_setback'
    | 'north_setback'
    | 'absolute_height'
    | 'shadow'
    | 'sky_factor'
    | 'wall_setback'
    | 'coverage'
    | 'floor_area';
  description: string;
  /** 3D geometry of the violating portion */
  violationVertices?: Float32Array;
  violationIndices?: Uint32Array;
}

/** Serializable project data for save/load */
export interface ProjectData {
  version: string;
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  latitude: number;
  floorHeights: number[];
}

// ---------------------------------------------------------------------------
// Shadow projection types (日影投影分析)
// ---------------------------------------------------------------------------

/** Height field data for shadow projection (serializable) */
export interface HeightFieldData {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  resolution: number;
  heights: Float32Array;
  insideMask: Uint8Array;
}

/** Shadow grid data - hours of shadow at each point */
export interface ShadowGridData {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  resolution: number;
  /** Shadow hours at each grid point */
  hours: Float32Array;
}

/** Result of shadow projection analysis */
export interface ShadowProjectionResult {
  /** Equal-time shadow grid (等時間日影図) */
  shadowGrid: ShadowGridData;
  /** 5m measurement line offset from site boundary */
  line5m: Point2D[];
  /** 10m measurement line offset from site boundary */
  line10m: Point2D[];
}

/** A single contour line (等高線) at a specific height */
export interface ContourLine {
  /** Height value of this contour in meters */
  height: number;
  /** Segments forming the contour: pairs of [start, end] */
  segments: { start: Point2D; end: Point2D }[];
}

// ---------------------------------------------------------------------------
// Building pattern types (建物パターン別日影シミュレーション)
// ---------------------------------------------------------------------------

/** Result for a single building pattern */
export interface PatternResult {
  name: string;            // '低層パターン' | '中高層パターン'
  footprint: Point2D[];    // 建物フットプリント
  maxHeight: number;       // 合成影で規制を満たす最大高さ
  maxFloors: number;
  footprintArea: number;   // 建築面積
  totalFloorArea: number;  // 延べ面積
  /** Additional inset (meters) applied to the buildable polygon */
  inset?: number;
  compliance: {
    passes: boolean;
    worstHoursAt5m: number;
    worstHoursAt10m: number;
  };
}

/** Combined result for low-rise and mid-high-rise patterns */
export interface BuildingPatternResult {
  lowRise: PatternResult;
  midHighRise: PatternResult;
  optimal: PatternResult;
}

/** Reverse shadow (逆日影) analysis result */
export interface ReverseShadowResult {
  /** Shadow-constrained height field (日影高さ制限面) */
  shadowHeightField: HeightFieldData;
  /** Contour lines of the shadow height constraint (逆日影ライン) */
  contourLines: ContourLine[];
  /** 5m measurement line offset from site boundary */
  line5m: Point2D[];
  /** 10m measurement line offset from site boundary */
  line10m: Point2D[];
}
