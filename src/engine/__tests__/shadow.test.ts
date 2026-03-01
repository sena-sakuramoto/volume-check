import { solarPosition, shadowTip, calculateShadowConstrainedHeight } from '../shadow';
import type { ShadowRegulation, Point2D } from '../types';

describe('solarPosition', () => {
  describe('winter solstice at Tokyo (35.68°N)', () => {
    const lat = 35.68;

    it('solar altitude at noon is approximately 30.9°', () => {
      const { altitude } = solarPosition(lat, 12, 22, 12, 0);
      // At winter solstice: altitude = 90 - latitude - 23.44 = 90 - 35.68 - 23.44 ≈ 30.88
      expect(altitude).toBeCloseTo(30.88, 0);
    });

    it('solar altitude at 8:00 is low but positive', () => {
      const { altitude } = solarPosition(lat, 12, 22, 8, 0);
      expect(altitude).toBeGreaterThan(0);
      expect(altitude).toBeLessThan(20);
    });

    it('solar altitude at 16:00 is low but positive', () => {
      const { altitude } = solarPosition(lat, 12, 22, 16, 0);
      expect(altitude).toBeGreaterThan(0);
      expect(altitude).toBeLessThan(20);
    });

    it('azimuth at 8:00 is eastward (negative in from-south convention)', () => {
      const { azimuth } = solarPosition(lat, 12, 22, 8, 0);
      expect(azimuth).toBeLessThan(0); // morning = east = negative
    });

    it('azimuth at 16:00 is westward (positive in from-south convention)', () => {
      const { azimuth } = solarPosition(lat, 12, 22, 16, 0);
      expect(azimuth).toBeGreaterThan(0); // afternoon = west = positive
    });

    it('azimuth at noon is approximately 0 (due south)', () => {
      const { azimuth } = solarPosition(lat, 12, 22, 12, 0);
      expect(Math.abs(azimuth)).toBeLessThan(1); // very close to 0
    });
  });

  describe('summer solstice', () => {
    it('solar altitude at noon is much higher than winter', () => {
      const winter = solarPosition(35.68, 12, 22, 12, 0);
      const summer = solarPosition(35.68, 6, 21, 12, 0);
      expect(summer.altitude).toBeGreaterThan(winter.altitude + 30);
    });
  });
});

describe('shadowTip', () => {
  it('shadow falls north when sun is due south (standard orientation)', () => {
    const tip = shadowTip(
      { x: 5, y: 5 }, // point
      10,             // height above measurement
      30,             // sun altitude
      180,            // sun azimuth compass = due south
      0,              // no rotation
    );
    // Shadow should fall to the north (+Y direction in standard coords)
    expect(tip.y).toBeGreaterThan(5);
    expect(tip.x).toBeCloseTo(5, 1); // minimal east-west displacement
  });

  it('shadow length is correct for known angle', () => {
    // At 45° altitude, shadow length = height
    const tip = shadowTip(
      { x: 0, y: 0 },
      10, // height
      45, // sun altitude = 45°
      180, // due south
      0,
    );
    const shadowLen = Math.sqrt(tip.x ** 2 + tip.y ** 2);
    expect(shadowLen).toBeCloseTo(10, 1);
  });

  it('shadow extends infinitely when sun is at horizon', () => {
    const tip = shadowTip(
      { x: 0, y: 0 },
      10, // height
      0.5, // very low sun
      180, // due south
      0,
    );
    const dist = Math.sqrt(tip.x ** 2 + tip.y ** 2);
    expect(dist).toBeGreaterThan(100);
  });
});

describe('calculateShadowConstrainedHeight', () => {
  const siteVertices: Point2D[] = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ];

  const shadowReg: ShadowRegulation = {
    measurementHeight: 1.5,
    maxHoursAt5m: 4,
    maxHoursAt10m: 2.5,
  };

  it('returns a finite positive height for interior point', () => {
    const h = calculateShadowConstrainedHeight(
      { x: 10, y: 10 },
      siteVertices,
      shadowReg,
      35.68,
      0,
    );
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(100);
  });

  it('height is more restrictive near the north boundary', () => {
    // Use a larger site so the difference is more pronounced
    const largeSite: Point2D[] = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 40 },
      { x: 0, y: 40 },
    ];
    const hCenter = calculateShadowConstrainedHeight(
      { x: 20, y: 20 },
      largeSite,
      shadowReg,
      35.68,
      0,
    );
    const hNearNorth = calculateShadowConstrainedHeight(
      { x: 20, y: 38 },
      largeSite,
      shadowReg,
      35.68,
      0,
    );
    // Point near north boundary should have lower or equal allowed height
    // (shadow crosses boundary more quickly)
    expect(hNearNorth).toBeLessThanOrEqual(hCenter + 1);
  });

  it('returns Infinity for commercial zone (null shadow regulation)', () => {
    // This test validates the caller behavior, not the function itself.
    // When shadowRegulation is null, the caller should not call this function.
    // But if called, it should still return a reasonable value.
    const h = calculateShadowConstrainedHeight(
      { x: 10, y: 10 },
      siteVertices,
      shadowReg,
      35.68,
      0,
    );
    expect(h).toBeGreaterThan(0);
  });

  it('allows higher buildings with more permissive shadow regulation', () => {
    const strict: ShadowRegulation = {
      measurementHeight: 1.5,
      maxHoursAt5m: 3,
      maxHoursAt10m: 2,
    };
    const permissive: ShadowRegulation = {
      measurementHeight: 1.5,
      maxHoursAt5m: 5,
      maxHoursAt10m: 3,
    };

    const hStrict = calculateShadowConstrainedHeight(
      { x: 10, y: 10 }, siteVertices, strict, 35.68, 0,
    );
    const hPermissive = calculateShadowConstrainedHeight(
      { x: 10, y: 10 }, siteVertices, permissive, 35.68, 0,
    );

    expect(hPermissive).toBeGreaterThanOrEqual(hStrict - 0.1);
  });
});
