import type {
  ZoningDistrict,
  RoadSetbackParams,
  AdjacentSetbackParams,
  NorthSetbackParams,
  ShadowRegulation,
} from './types';

interface ZoningDefaults {
  absoluteHeightLimit: number | null;
  wallSetback: number | null;
  defaultCoverageRatio: number;
  defaultFloorAreaRatio: number;
  shadowRegulation: ShadowRegulation | null;
}

const ZONING_TABLE: Record<ZoningDistrict, ZoningDefaults> = {
  '第一種低層住居専用地域': {
    absoluteHeightLimit: 10,
    wallSetback: 1,
    defaultCoverageRatio: 0.5,
    defaultFloorAreaRatio: 1.0,
    shadowRegulation: { measurementHeight: 1.5, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  },
  '第二種低層住居専用地域': {
    absoluteHeightLimit: 10,
    wallSetback: 1,
    defaultCoverageRatio: 0.5,
    defaultFloorAreaRatio: 1.0,
    shadowRegulation: { measurementHeight: 1.5, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  },
  '第一種中高層住居専用地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  },
  '第二種中高層住居専用地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  },
  '第一種住居地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 5, maxHoursAt10m: 3 },
  },
  '第二種住居地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 5, maxHoursAt10m: 3 },
  },
  '準住居地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 5, maxHoursAt10m: 3 },
  },
  '田園住居地域': {
    absoluteHeightLimit: 10,
    wallSetback: 1,
    defaultCoverageRatio: 0.5,
    defaultFloorAreaRatio: 1.0,
    shadowRegulation: { measurementHeight: 1.5, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  },
  '近隣商業地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.8,
    defaultFloorAreaRatio: 3.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 5, maxHoursAt10m: 3 },
  },
  '商業地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.8,
    defaultFloorAreaRatio: 4.0,
    shadowRegulation: null,
  },
  '準工業地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: { measurementHeight: 4, maxHoursAt5m: 5, maxHoursAt10m: 3 },
  },
  '工業地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: null,
  },
  '工業専用地域': {
    absoluteHeightLimit: null,
    wallSetback: null,
    defaultCoverageRatio: 0.6,
    defaultFloorAreaRatio: 2.0,
    shadowRegulation: null,
  },
};

export function getZoningDefaults(district: ZoningDistrict): ZoningDefaults {
  return ZONING_TABLE[district];
}

/** Residential zones use slope ratio 1.25, others use 1.5 */
const RESIDENTIAL_ZONES: ZoningDistrict[] = [
  '第一種低層住居専用地域',
  '第二種低層住居専用地域',
  '第一種中高層住居専用地域',
  '第二種中高層住居専用地域',
  '第一種住居地域',
  '第二種住居地域',
  '準住居地域',
  '田園住居地域',
];

export function getRoadSetbackParams(district: ZoningDistrict): RoadSetbackParams {
  const isResidential = RESIDENTIAL_ZONES.includes(district);
  return {
    slopeRatio: isResidential ? 1.25 : 1.5,
    applicationDistance: isResidential ? 20 : 25,
    setbackDistance: 0,
  };
}

export function getAdjacentSetbackParams(district: ZoningDistrict): AdjacentSetbackParams {
  const isResidential = RESIDENTIAL_ZONES.includes(district);
  return {
    riseHeight: isResidential ? 20 : 31,
    slopeRatio: isResidential ? 1.25 : 2.5,
  };
}

/** North setback only applies to low-rise residential and 田園住居 zones */
const NORTH_SETBACK_ZONES_5M: ZoningDistrict[] = [
  '第一種低層住居専用地域',
  '第二種低層住居専用地域',
  '田園住居地域',
];

const NORTH_SETBACK_ZONES_10M: ZoningDistrict[] = [
  '第一種中高層住居専用地域',
  '第二種中高層住居専用地域',
];

export function getNorthSetbackParams(district: ZoningDistrict): NorthSetbackParams | null {
  if (NORTH_SETBACK_ZONES_5M.includes(district)) {
    return { riseHeight: 5, slopeRatio: 1.25 };
  }
  if (NORTH_SETBACK_ZONES_10M.includes(district)) {
    return { riseHeight: 10, slopeRatio: 1.25 };
  }
  return null;
}

export function isResidentialZone(district: ZoningDistrict): boolean {
  return RESIDENTIAL_ZONES.includes(district);
}
