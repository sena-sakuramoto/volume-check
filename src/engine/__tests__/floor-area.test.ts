import { calculateMaxFloorArea } from '../floor-area';
import type { SiteBoundary, ZoningData, Road } from '../types';

const site: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ],
  area: 150,
};

function makeZoning(overrides: Partial<ZoningData> = {}): ZoningData {
  return {
    district: '第一種低層住居専用地域',
    fireDistrict: '指定なし',
    heightDistrict: { type: '指定なし' },
    coverageRatio: 0.6,
    floorAreaRatio: 1.0,
    absoluteHeightLimit: 10,
    wallSetback: 1,
    shadowRegulation: null,
    isCornerLot: false,
    districtPlan: null,
    ...overrides,
  };
}

function makeRoad(width: number): Road {
  return {
    edgeStart: { x: 0, y: 0 },
    edgeEnd: { x: 10, y: 0 },
    width,
    centerOffset: width / 2,
    bearing: 180,
  };
}

describe('calculateMaxFloorArea', () => {
  describe('designated FAR when road-based FAR is higher', () => {
    it('uses designated FAR for a wide road in residential zone', () => {
      const zoning = makeZoning({ floorAreaRatio: 1.0 });
      const roads = [makeRoad(6)];
      // Road-based: 6 * 0.4 = 2.4 -> designated 1.0 is lower
      // 150 * 1.0 = 150
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(150);
    });

    it('uses designated FAR of 2.0 for a wide road', () => {
      const zoning = makeZoning({
        district: '第一種中高層住居専用地域',
        floorAreaRatio: 2.0,
      });
      const roads = [makeRoad(8)];
      // Road-based: 8 * 0.4 = 3.2 -> designated 2.0 is lower
      // 150 * 2.0 = 300
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(300);
    });
  });

  describe('road width limitation for residential zones (0.4 multiplier)', () => {
    it('limits FAR based on narrow road in residential zone', () => {
      const zoning = makeZoning({ floorAreaRatio: 2.0 });
      const roads = [makeRoad(4)];
      // Road-based: 4 * 0.4 = 1.6 -> lower than designated 2.0
      // 150 * 1.6 = 240
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(240);
    });

    it('limits FAR for very narrow road (2m)', () => {
      const zoning = makeZoning({ floorAreaRatio: 1.0 });
      const roads = [makeRoad(2)];
      // Road-based: 2 * 0.4 = 0.8 -> lower than designated 1.0
      // 150 * 0.8 = 120
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(120);
    });
  });

  describe('road width limitation for commercial zones (0.6 multiplier)', () => {
    it('limits FAR based on road width in commercial zone', () => {
      const zoning = makeZoning({
        district: '商業地域',
        floorAreaRatio: 4.0,
      });
      const roads = [makeRoad(4)];
      // Road-based: 4 * 0.6 = 2.4 -> lower than designated 4.0
      // 150 * 2.4 = 360
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(360);
    });

    it('uses designated FAR when road is wide enough in commercial zone', () => {
      const zoning = makeZoning({
        district: '商業地域',
        floorAreaRatio: 4.0,
      });
      const roads = [makeRoad(12)];
      // Road-based: 12 * 0.6 = 7.2 -> designated 4.0 is lower
      // 150 * 4.0 = 600
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(600);
    });

    it('uses 0.6 multiplier for 近隣商業地域', () => {
      const zoning = makeZoning({
        district: '近隣商業地域',
        floorAreaRatio: 3.0,
      });
      const roads = [makeRoad(4)];
      // Road-based: 4 * 0.6 = 2.4 -> lower than designated 3.0
      // 150 * 2.4 = 360
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(360);
    });
  });

  describe('road width limitation for industrial zones (0.6 multiplier)', () => {
    it('uses 0.6 multiplier for 工業地域', () => {
      const zoning = makeZoning({
        district: '工業地域',
        floorAreaRatio: 2.0,
      });
      const roads = [makeRoad(4)];
      // Road-based: 4 * 0.6 = 2.4 -> designated 2.0 is lower
      // 150 * 2.0 = 300
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(300);
    });

    it('uses road-based FAR when it limits 準工業地域', () => {
      const zoning = makeZoning({
        district: '準工業地域',
        floorAreaRatio: 2.0,
      });
      const roads = [makeRoad(2)];
      // Road-based: 2 * 0.6 = 1.2 -> lower than designated 2.0
      // 150 * 1.2 = 180
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(180);
    });
  });

  describe('widest road selection', () => {
    it('uses the widest road when multiple roads are present', () => {
      const zoning = makeZoning({ floorAreaRatio: 2.0 });
      const roads = [makeRoad(4), makeRoad(6), makeRoad(3)];
      // Widest road = 6m. Road-based: 6 * 0.4 = 2.4 -> designated 2.0 is lower
      // 150 * 2.0 = 300
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(300);
    });

    it('widest road changes the effective FAR', () => {
      const zoning = makeZoning({ floorAreaRatio: 2.0 });
      // With only narrow road
      const narrowRoads = [makeRoad(3)];
      // Road-based: 3 * 0.4 = 1.2 -> lower than 2.0
      // 150 * 1.2 = 180
      expect(calculateMaxFloorArea(site, zoning, narrowRoads)).toBe(180);

      // With wide road added
      const wideRoads = [makeRoad(3), makeRoad(8)];
      // Road-based: 8 * 0.4 = 3.2 -> designated 2.0 is lower
      // 150 * 2.0 = 300
      expect(calculateMaxFloorArea(site, zoning, wideRoads)).toBe(300);
    });

    it('handles two roads of equal width', () => {
      const zoning = makeZoning({ floorAreaRatio: 1.0 });
      const roads = [makeRoad(4), makeRoad(4)];
      // Road-based: 4 * 0.4 = 1.6 -> designated 1.0 is lower
      // 150 * 1.0 = 150
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(150);
    });
  });

  describe('edge cases', () => {
    it('road-based FAR exactly equals designated FAR', () => {
      const zoning = makeZoning({ floorAreaRatio: 2.0 });
      const roads = [makeRoad(5)];
      // Road-based: 5 * 0.4 = 2.0 -> exactly equals designated
      // 150 * 2.0 = 300
      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(300);
    });

    it('handles different site area', () => {
      const smallSite: SiteBoundary = {
        vertices: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 8, y: 10 },
          { x: 0, y: 10 },
        ],
        area: 80,
      };
      const zoning = makeZoning({ floorAreaRatio: 1.5 });
      const roads = [makeRoad(6)];
      // Road-based: 6 * 0.4 = 2.4 -> designated 1.5 is lower
      // 80 * 1.5 = 120
      expect(calculateMaxFloorArea(smallSite, zoning, roads)).toBe(120);
    });

    it('caps FAR by a stricter district plan ratio', () => {
      const zoning = makeZoning({
        floorAreaRatio: 2.0,
        districtPlan: { name: '地区計画', floorAreaRatio: 1.2 },
      });
      const roads = [makeRoad(8)];

      expect(calculateMaxFloorArea(site, zoning, roads)).toBe(180);
    });
  });
});
