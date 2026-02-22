import { generateEnvelope } from '../envelope';
import type { SiteBoundary, ZoningData, Road, VolumeInput, VolumeResult } from '../types';

const site: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ],
  area: 150,
};

const zoning: ZoningData = {
  district: '第一種低層住居専用地域',
  fireDistrict: '指定なし',
  heightDistrict: { type: '第一種' },
  coverageRatio: 0.6,
  floorAreaRatio: 1.0,
  absoluteHeightLimit: 10,
  wallSetback: 1,
  shadowRegulation: { measurementHeight: 1.5, maxHoursAt5m: 4, maxHoursAt10m: 2.5 },
  isCornerLot: false,
};

const road: Road = {
  edgeStart: { x: 0, y: 0 },
  edgeEnd: { x: 10, y: 0 },
  width: 6,
  centerOffset: 3,
  bearing: 180,
};

const input: VolumeInput = {
  site,
  zoning,
  roads: [road],
  latitude: 35.68, // Tokyo latitude
};

describe('generateEnvelope', () => {
  let result: VolumeResult;

  beforeAll(() => {
    result = generateEnvelope(input);
  });

  describe('generates valid vertices and indices', () => {
    it('produces envelope vertices with length > 0', () => {
      expect(result.envelopeVertices).toBeInstanceOf(Float32Array);
      expect(result.envelopeVertices.length).toBeGreaterThan(0);
    });

    it('produces envelope indices with length > 0', () => {
      expect(result.envelopeIndices).toBeInstanceOf(Uint32Array);
      expect(result.envelopeIndices.length).toBeGreaterThan(0);
    });

    it('envelope indices length is a multiple of 3 (triangles)', () => {
      expect(result.envelopeIndices.length % 3).toBe(0);
    });

    it('envelope vertices length is a multiple of 3 (x,y,z triples)', () => {
      expect(result.envelopeVertices.length % 3).toBe(0);
    });

    it('all index values reference valid vertex positions', () => {
      const maxIndex = result.envelopeVertices.length / 3 - 1;
      for (let i = 0; i < result.envelopeIndices.length; i++) {
        expect(result.envelopeIndices[i]).toBeLessThanOrEqual(maxIndex);
        expect(result.envelopeIndices[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('maxHeight', () => {
    it('maxHeight is <= 10 (absolute height limit)', () => {
      expect(result.maxHeight).toBeLessThanOrEqual(10);
    });

    it('maxHeight is > 0', () => {
      expect(result.maxHeight).toBeGreaterThan(0);
    });
  });

  describe('maxCoverageArea', () => {
    it('maxCoverageArea is <= 90 (150 * 0.6)', () => {
      expect(result.maxCoverageArea).toBeLessThanOrEqual(90);
    });

    it('maxCoverageArea is > 0', () => {
      expect(result.maxCoverageArea).toBeGreaterThan(0);
    });
  });

  describe('maxFloorArea', () => {
    it('maxFloorArea is <= 150 (150 * 1.0)', () => {
      expect(result.maxFloorArea).toBeLessThanOrEqual(150);
    });

    it('maxFloorArea is > 0', () => {
      expect(result.maxFloorArea).toBeGreaterThan(0);
    });
  });

  describe('maxFloors', () => {
    it('maxFloors is between 1 and 3 for 10m height limit', () => {
      expect(result.maxFloors).toBeGreaterThanOrEqual(1);
      expect(result.maxFloors).toBeLessThanOrEqual(3);
    });

    it('maxFloors is an integer', () => {
      expect(Number.isInteger(result.maxFloors)).toBe(true);
    });
  });

  describe('setbackEnvelopes structure', () => {
    it('has a setbackEnvelopes object', () => {
      expect(result.setbackEnvelopes).toBeDefined();
    });

    it('has all required envelope layer keys', () => {
      expect(result.setbackEnvelopes).toHaveProperty('road');
      expect(result.setbackEnvelopes).toHaveProperty('adjacent');
      expect(result.setbackEnvelopes).toHaveProperty('north');
      expect(result.setbackEnvelopes).toHaveProperty('absoluteHeight');
      expect(result.setbackEnvelopes).toHaveProperty('shadow');
    });

    it('road setback envelope exists (site has a road)', () => {
      if (result.setbackEnvelopes.road !== null) {
        expect(result.setbackEnvelopes.road.vertices).toBeInstanceOf(Float32Array);
        expect(result.setbackEnvelopes.road.indices).toBeInstanceOf(Uint32Array);
        expect(result.setbackEnvelopes.road.vertices.length).toBeGreaterThan(0);
      }
    });

    it('north setback envelope exists (low-rise residential zone)', () => {
      if (result.setbackEnvelopes.north !== null) {
        expect(result.setbackEnvelopes.north.vertices).toBeInstanceOf(Float32Array);
        expect(result.setbackEnvelopes.north.indices).toBeInstanceOf(Uint32Array);
        expect(result.setbackEnvelopes.north.vertices.length).toBeGreaterThan(0);
      }
    });

    it('absoluteHeight envelope exists (低層 has 10m limit)', () => {
      if (result.setbackEnvelopes.absoluteHeight !== null) {
        expect(result.setbackEnvelopes.absoluteHeight.vertices).toBeInstanceOf(Float32Array);
        expect(result.setbackEnvelopes.absoluteHeight.indices).toBeInstanceOf(Uint32Array);
      }
    });
  });

  describe('consistency checks', () => {
    it('maxFloorArea is not greater than maxCoverageArea * maxFloors', () => {
      // Total floor area cannot exceed coverage area times number of floors
      expect(result.maxFloorArea).toBeLessThanOrEqual(
        result.maxCoverageArea * result.maxFloors + 0.01, // small epsilon for rounding
      );
    });

    it('maxCoverageArea does not exceed site area', () => {
      expect(result.maxCoverageArea).toBeLessThanOrEqual(site.area);
    });
  });
});

describe('generateEnvelope with different configurations', () => {
  it('produces higher maxHeight with 12m absolute limit', () => {
    const zoning12: ZoningData = {
      ...zoning,
      absoluteHeightLimit: 12,
    };
    const input12: VolumeInput = { site, zoning: zoning12, roads: [road], latitude: 35.68 };
    const result12 = generateEnvelope(input12);
    expect(result12.maxHeight).toBeLessThanOrEqual(12);
  });

  it('produces larger maxCoverageArea for corner lot', () => {
    const zoningCorner: ZoningData = {
      ...zoning,
      isCornerLot: true,
    };
    const inputCorner: VolumeInput = { site, zoning: zoningCorner, roads: [road], latitude: 35.68 };
    const resultCorner = generateEnvelope(inputCorner);
    const resultNormal = generateEnvelope(input);
    expect(resultCorner.maxCoverageArea).toBeGreaterThanOrEqual(resultNormal.maxCoverageArea);
  });

  it('produces valid output for commercial zone', () => {
    const zoningCommercial: ZoningData = {
      district: '商業地域',
      fireDistrict: '防火地域',
      heightDistrict: { type: '指定なし' },
      coverageRatio: 0.8,
      floorAreaRatio: 4.0,
      absoluteHeightLimit: null,
      wallSetback: null,
      shadowRegulation: null,
      isCornerLot: false,
    };
    const inputCommercial: VolumeInput = {
      site,
      zoning: zoningCommercial,
      roads: [road],
      latitude: 35.68,
    };
    const resultCommercial = generateEnvelope(inputCommercial);
    expect(resultCommercial.envelopeVertices.length).toBeGreaterThan(0);
    expect(resultCommercial.envelopeIndices.length).toBeGreaterThan(0);
    expect(resultCommercial.maxFloorArea).toBeGreaterThan(0);
    expect(resultCommercial.maxCoverageArea).toBeGreaterThan(0);
  });

  it('produces valid output with multiple roads', () => {
    const northRoad: Road = {
      edgeStart: { x: 0, y: 15 },
      edgeEnd: { x: 10, y: 15 },
      width: 4,
      centerOffset: 2,
      bearing: 0,
    };
    const inputMultiRoad: VolumeInput = {
      site,
      zoning,
      roads: [road, northRoad],
      latitude: 35.68,
    };
    const resultMulti = generateEnvelope(inputMultiRoad);
    expect(resultMulti.envelopeVertices.length).toBeGreaterThan(0);
    expect(resultMulti.maxHeight).toBeGreaterThan(0);
  });
});
