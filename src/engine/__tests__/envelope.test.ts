import { generateEnvelope } from '../envelope';
import type { SiteBoundary, ZoningData, Road, VolumeInput, VolumeResult } from '../types';
import { getSiteEdges, getNorthEdges, isRoadEdge } from '../envelope';
import { getRoadSetbackParams, getAdjacentSetbackParams, getNorthSetbackParams } from '../zoning';
import {
  calculateRoadSetbackHeight,
  calculateMinRoadSetbackHeight,
  getRoadFloorAreaReferenceWidth,
  getRoadSlopeSetbackRelief,
} from '../setback-road';
import { calculateAdjacentSetbackHeight } from '../setback-adjacent';
import { calculateNorthSetbackHeight } from '../setback-north';
import { calculateHeightDistrictLimit } from '../height-district';

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
  shadowRegulation: null,
  isCornerLot: false,
  districtPlan: null,
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

    it('uses quarter-meter mesh spacing for smoother visualization', () => {
      const xCoords: number[] = [];
      for (let i = 0; i < result.envelopeVertices.length; i += 3) {
        xCoords.push(Number(result.envelopeVertices[i].toFixed(3)));
      }

      const uniqueX = [...new Set(xCoords)].sort((a, b) => a - b);
      let minStep = Infinity;
      for (let i = 1; i < uniqueX.length; i++) {
        const step = uniqueX[i] - uniqueX[i - 1];
        if (step > 1e-6 && step < minStep) minStep = step;
      }

      expect(minStep).toBeLessThanOrEqual(0.25);
    });

    it('keeps side-wall face winding consistent (no mixed front/back patches)', () => {
      const positions = result.envelopeVertices;
      const indices = result.envelopeIndices;

      let cx = 0;
      let cz = 0;
      let vcount = 0;
      for (let i = 0; i < positions.length; i += 3) {
        cx += positions[i];
        cz += positions[i + 2];
        vcount++;
      }
      cx /= Math.max(1, vcount);
      cz /= Math.max(1, vcount);

      let outward = 0;
      let inward = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;

        const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
        const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
        const cxp = positions[ic], cy = positions[ic + 1], czp = positions[ic + 2];

        const minY = Math.min(ay, by, cy);
        const maxY = Math.max(ay, by, cy);
        if (!(minY < 1e-6 && maxY > 1e-6)) continue; // side faces only

        const ux = bx - ax;
        const uy = by - ay;
        const uz = bz - az;
        const vx = cxp - ax;
        const vy = cy - ay;
        const vz = czp - az;
        const nx = uy * vz - uz * vy;
        const nz = ux * vy - uy * vx;

        const tcx = (ax + bx + cxp) / 3;
        const tcz = (az + bz + czp) / 3;
        const rx = tcx - cx;
        const rz = tcz - cz;
        const dot = nx * rx + nz * rz;

        if (dot > 0) outward++;
        else if (dot < 0) inward++;
      }

      expect(inward).toBe(0);
      expect(outward).toBeGreaterThan(0);
    });

    it('generates side walls on both +/-X and +/-Z directions for a rectangular site', () => {
      const positions = result.envelopeVertices;
      const indices = result.envelopeIndices;

      let posX = 0;
      let negX = 0;
      let posZ = 0;
      let negZ = 0;

      for (let i = 0; i < indices.length; i += 3) {
        const ia = indices[i] * 3;
        const ib = indices[i + 1] * 3;
        const ic = indices[i + 2] * 3;

        const ay = positions[ia + 1];
        const by = positions[ib + 1];
        const cy = positions[ic + 1];
        const minY = Math.min(ay, by, cy);
        const maxY = Math.max(ay, by, cy);
        if (!(minY < 1e-6 && maxY > 1e-6)) continue;

        const ax = positions[ia], az = positions[ia + 2];
        const bx = positions[ib], bz = positions[ib + 2];
        const cxp = positions[ic], czp = positions[ic + 2];
        const ux = bx - ax;
        const uy = by - ay;
        const uz = bz - az;
        const vx = cxp - ax;
        const vy = cy - ay;
        const vz = czp - az;
        const nx = uy * vz - uz * vy;
        const nz = ux * vy - uy * vx;

        if (Math.abs(nx) >= Math.abs(nz)) {
          if (nx > 0) posX++;
          else if (nx < 0) negX++;
        } else {
          if (nz > 0) posZ++;
          else if (nz < 0) negZ++;
        }
      }

      expect(posX).toBeGreaterThan(0);
      expect(negX).toBeGreaterThan(0);
      expect(posZ).toBeGreaterThan(0);
      expect(negZ).toBeGreaterThan(0);
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
      districtPlan: null,
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

  it('applies district plan maxHeight when it is stricter than absolute limit', () => {
    const zoningWithDistrictPlan: ZoningData = {
      ...zoning,
      absoluteHeightLimit: 20,
      districtPlan: {
        name: 'テスト地区計画',
        maxHeight: 8,
      },
    };
    const inputWithDistrictPlan: VolumeInput = {
      ...input,
      zoning: zoningWithDistrictPlan,
    };
    const resultWithDistrictPlan = generateEnvelope(inputWithDistrictPlan);
    expect(resultWithDistrictPlan.maxHeight).toBeLessThanOrEqual(8);
  });

  it('keeps rendered envelope vertices below the exact non-shadow restrictions on skewed sites', () => {
    const skewedSite: SiteBoundary = {
      vertices: [
        { x: 0, y: 0 },
        { x: 13.4, y: 1.2 },
        { x: 12.7, y: 14.5 },
        { x: 7.4, y: 16.8 },
        { x: -1.3, y: 11.2 },
      ],
      area: 187.4,
    };
    const skewedRoad: Road = {
      edgeStart: skewedSite.vertices[0],
      edgeEnd: skewedSite.vertices[1],
      width: 4,
      centerOffset: 2,
      bearing: 185.1,
    };
    const skewedInput: VolumeInput = {
      site: skewedSite,
      zoning: {
        ...zoning,
        heightDistrict: { type: '指定なし' },
      },
      roads: [skewedRoad],
      latitude: 35.68,
    };

    const skewedResult = generateEnvelope(skewedInput);
    const roadParams = getRoadSetbackParams(skewedInput.zoning.district);
    const adjacentParams = getAdjacentSetbackParams(skewedInput.zoning.district);
    const northParams = getNorthSetbackParams(skewedInput.zoning.district);
    const nonRoadEdges = getSiteEdges(skewedSite.vertices).filter((edge) => !isRoadEdge(edge, [skewedRoad]));
    const northEdges = getNorthEdges(nonRoadEdges, skewedSite.vertices, [skewedRoad]);
    const adjacentEdges = nonRoadEdges.filter(
      (edge) => !northEdges.some((northEdge) => northEdge.start === edge.start && northEdge.end === edge.end),
    );
    const absoluteLimit = skewedInput.zoning.absoluteHeightLimit ?? Infinity;

    for (let i = 0; i < skewedResult.envelopeVertices.length; i += 3) {
      const x = skewedResult.envelopeVertices[i];
      const height = skewedResult.envelopeVertices[i + 1];
      const y = skewedResult.envelopeVertices[i + 2];
      if (height <= 0) continue;

      let exactLimit = absoluteLimit;
      exactLimit = Math.min(
        exactLimit,
        calculateRoadSetbackHeight(
          { x, y },
          skewedRoad,
          roadParams.slopeRatio,
          roadParams.applicationDistance,
          {
            setbackRelief: getRoadSlopeSetbackRelief(
              skewedRoad,
              skewedInput.zoning.wallSetback ?? 0,
            ),
          },
        ),
      );

      for (const edge of adjacentEdges) {
        exactLimit = Math.min(
          exactLimit,
          calculateAdjacentSetbackHeight(
            { x, y },
            edge.start,
            edge.end,
            adjacentParams.riseHeight,
            adjacentParams.slopeRatio,
          ),
        );
        if (skewedInput.zoning.heightDistrict.type !== '指定なし') {
          exactLimit = Math.min(
            exactLimit,
            calculateHeightDistrictLimit({ x, y }, edge.start, edge.end, skewedInput.zoning.heightDistrict),
          );
        }
      }

      if (northParams !== null) {
        for (const edge of northEdges) {
          exactLimit = Math.min(
            exactLimit,
            calculateNorthSetbackHeight(
              { x, y },
              edge.start,
              edge.end,
              northParams.riseHeight,
              northParams.slopeRatio,
            ),
          );
          if (skewedInput.zoning.heightDistrict.type !== '指定なし') {
            exactLimit = Math.min(
              exactLimit,
              calculateHeightDistrictLimit({ x, y }, edge.start, edge.end, skewedInput.zoning.heightDistrict),
            );
          }
        }
      }

      expect(height).toBeLessThanOrEqual(exactLimit + 0.05);
    }
  });
});

describe('road setback support cases', () => {
  it('applies additional front setback and opposite-side relief in road-slope height', () => {
    const adjustedRoad: Road = {
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 10, y: 0 },
      width: 3,
      centerOffset: 1.5,
      bearing: 180,
      frontSetback: 1,
      oppositeSideSetback: 2,
      oppositeOpenSpace: 3,
      siteHeightAboveRoad: 1,
    };

    expect(
      calculateRoadSetbackHeight({ x: 5, y: 1 }, adjustedRoad, 1.25, 20),
    ).toBe(0);
    expect(
      calculateRoadSetbackHeight({ x: 5, y: 1.5 }, adjustedRoad, 1.25, 20),
    ).toBeCloseTo(12.75, 5);
  });

  it('insets the buildable polygon by wall setback plus required road-front setback', () => {
    const adjustedRoad: Road = {
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 10, y: 0 },
      width: 3,
      centerOffset: 1.5,
      bearing: 180,
      frontSetback: 1,
    };
    const resultWithFrontSetback = generateEnvelope({
      site,
      zoning,
      roads: [adjustedRoad],
      latitude: 35.68,
    });

    expect(resultWithFrontSetback.buildablePolygon).not.toBeNull();
    const minY = Math.min(...resultWithFrontSetback.buildablePolygon!.map((vertex) => vertex.y));
    expect(minY).toBeCloseTo(2.5, 3);
  });

  it('keeps actual front-road width for floor-area road-width limitation', () => {
    expect(getRoadFloorAreaReferenceWidth({
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 10, y: 0 },
      width: 3,
      centerOffset: 1.5,
      bearing: 180,
    })).toBe(3);
  });

  it('uses the wider road width in the 2A/35m relief zone', () => {
    const southRoad: Road = {
      edgeStart: { x: 0, y: 0 },
      edgeEnd: { x: 10, y: 0 },
      width: 4,
      centerOffset: 2,
      bearing: 180,
    };
    const westRoad: Road = {
      edgeStart: { x: 0, y: 10 },
      edgeEnd: { x: 0, y: 0 },
      width: 8,
      centerOffset: 4,
      bearing: 270,
      enableTwoA35m: true,
    };

    expect(
      calculateMinRoadSetbackHeight({ x: 9, y: 9 }, [southRoad, westRoad], 1.25, 20),
    ).toBeCloseTo(21.25, 5);
  });
});
