import { validateVolumeInput, isSimplePolygon, VolumeInputSchema } from '../validation';
import type { VolumeInput, ZoningData, Road, SiteBoundary } from '../types';

const validZoning: ZoningData = {
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

const validRoad: Road = {
  edgeStart: { x: 0, y: 0 },
  edgeEnd: { x: 10, y: 0 },
  width: 6,
  centerOffset: 3,
  bearing: 180,
};

const validSite: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 15 },
    { x: 0, y: 15 },
  ],
  area: 150,
};

const validInput: VolumeInput = {
  site: validSite,
  zoning: validZoning,
  roads: [validRoad],
  latitude: 35.68,
};

describe('validateVolumeInput', () => {
  it('returns no errors for valid input', () => {
    const errors = validateVolumeInput(validInput);
    expect(errors).toHaveLength(0);
  });

  it('returns error for only 2 vertices', () => {
    const input = {
      ...validInput,
      site: {
        vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
        area: 50,
      },
    };
    const errors = validateVolumeInput(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field.includes('vertices'))).toBe(true);
  });

  it('returns error for self-intersecting polygon', () => {
    // Bowtie shape: self-intersecting
    const input = {
      ...validInput,
      site: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
        ],
        area: 50,
      },
    };
    const errors = validateVolumeInput(input);
    expect(errors.some(e => e.message.includes('自己交差'))).toBe(true);
  });

  it('returns error for NaN coordinates', () => {
    const input = {
      ...validInput,
      site: {
        vertices: [
          { x: NaN, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 15 },
        ],
        area: 75,
      },
    };
    const errors = validateVolumeInput(input);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error for area mismatch > 10%', () => {
    const input = {
      ...validInput,
      site: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 15 },
          { x: 0, y: 15 },
        ],
        area: 300, // declared 300, computed 150 -> 100% divergence
      },
    };
    const errors = validateVolumeInput(input);
    expect(errors.some(e => e.field === 'site.area')).toBe(true);
  });

  it('allows area within 10% tolerance', () => {
    const input = {
      ...validInput,
      site: {
        vertices: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 15 },
          { x: 0, y: 15 },
        ],
        area: 145, // declared 145, computed 150 -> ~3.4% divergence -> OK
      },
    };
    const errors = validateVolumeInput(input);
    expect(errors.some(e => e.field === 'site.area')).toBe(false);
  });

  it('returns error for road width 0', () => {
    const input = {
      ...validInput,
      roads: [{ ...validRoad, width: 0 }],
    };
    const errors = validateVolumeInput(input);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('returns error for invalid zoning district name', () => {
    const input = {
      ...validInput,
      zoning: { ...validZoning, district: '架空地域' as any },
    };
    const errors = validateVolumeInput(input);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes for input with no roads (valid case)', () => {
    const input = {
      ...validInput,
      roads: [],
    };
    const errors = validateVolumeInput(input);
    expect(errors).toHaveLength(0);
  });
});

describe('isSimplePolygon', () => {
  it('returns true for a simple rectangle', () => {
    expect(isSimplePolygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ])).toBe(true);
  });

  it('returns true for a simple triangle', () => {
    expect(isSimplePolygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ])).toBe(true);
  });

  it('returns false for a bowtie (self-intersecting)', () => {
    expect(isSimplePolygon([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ])).toBe(false);
  });

  it('returns false for fewer than 3 vertices', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('returns true for an L-shaped polygon', () => {
    expect(isSimplePolygon([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ])).toBe(true);
  });
});

describe('VolumeInputSchema', () => {
  it('parses valid input', () => {
    const result = VolumeInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects negative road width', () => {
    const input = {
      ...validInput,
      roads: [{ ...validRoad, width: -1 }],
    };
    const result = VolumeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects latitude out of range', () => {
    const input = { ...validInput, latitude: 100 };
    const result = VolumeInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
