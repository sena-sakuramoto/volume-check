import type { SiteBoundary, Road, ZoningData, VolumeInput } from '@/engine/types';

export const DEMO_SITE: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ],
  area: 150,
};

export const DEMO_ROADS: Road[] = [
  {
    edgeStart: { x: 0, y: 0 },
    edgeEnd: { x: 10, y: 0 },
    width: 6,
    centerOffset: 3,
    bearing: 180,
  },
];

export const DEMO_ZONING: ZoningData = {
  district: '第一種低層住居専用地域',
  fireDistrict: '指定なし',
  heightDistrict: { type: '指定なし' },
  coverageRatio: 0.6,
  floorAreaRatio: 1.0,
  absoluteHeightLimit: 10,
  wallSetback: 1,
  shadowRegulation: {
    measurementHeight: 1.5,
    maxHoursAt5m: 4,
    maxHoursAt10m: 2.5,
  },
  isCornerLot: false,
};

export const DEMO_INPUT: VolumeInput = {
  site: DEMO_SITE,
  zoning: DEMO_ZONING,
  roads: DEMO_ROADS,
  latitude: 35.68,
};
