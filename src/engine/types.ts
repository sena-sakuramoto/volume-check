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
