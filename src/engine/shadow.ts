import type { Point2D, ShadowRegulation } from './types';
import { distanceToSegment, isInsidePolygon } from './geometry';

// ---------------------------------------------------------------------------
// 5a: Solar position calculation (simplified SPA)
// ---------------------------------------------------------------------------

/**
 * Calculate solar position (altitude and azimuth) for a given location and time.
 * Uses a simplified Solar Position Algorithm based on declination and hour angle.
 *
 * @param latitude - Observer latitude in degrees (positive north)
 * @param month - Month (1-12)
 * @param day - Day of month
 * @param hour - Hour (0-23, solar time)
 * @param minute - Minute (0-59)
 * @returns { altitude, azimuth } in degrees. Azimuth: 0=S, positive=W, negative=E
 *          (converted to compass below for shadow projection)
 */
export function solarPosition(
  latitude: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): { altitude: number; azimuth: number } {
  const latRad = (latitude * Math.PI) / 180;

  // Day of year
  const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let dayOfYear = day;
  for (let m = 1; m < month; m++) {
    dayOfYear += daysInMonth[m];
  }

  // Solar declination (simplified)
  // Maximum declination at summer solstice (day ~172), minimum at winter solstice (day ~356)
  const declination = -23.44 * Math.cos((2 * Math.PI * (dayOfYear + 10)) / 365);
  const decRad = (declination * Math.PI) / 180;

  // Hour angle: 0 at solar noon (12:00), 15° per hour
  const solarTime = hour + minute / 60;
  const hourAngle = (solarTime - 12) * 15;
  const haRad = (hourAngle * Math.PI) / 180;

  // Solar altitude
  const sinAlt =
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * (180 / Math.PI);

  // Solar azimuth from NORTH (standard formula gives 0°=N, 180°=S)
  const cosAltRad = Math.cos(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  let azFromNorth: number;
  if (cosAltRad < 1e-10) {
    // Sun at zenith — azimuth is undefined
    azFromNorth = 180;
  } else {
    const cosAz =
      (Math.sin(decRad) - Math.sin(latRad) * sinAlt) /
      (Math.cos(latRad) * cosAltRad);
    azFromNorth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * (180 / Math.PI);
    // In the afternoon, azimuth is > 180° from north (western half)
    if (hourAngle > 0) {
      azFromNorth = 360 - azFromNorth;
    }
  }

  // Convert to from-south convention: 0=S, positive=W, negative=E
  let azimuth = azFromNorth - 180;
  // Normalize to [-180, 180]
  if (azimuth > 180) azimuth -= 360;
  if (azimuth < -180) azimuth += 360;

  return { altitude, azimuth };
}

/**
 * Convert solar azimuth (from-south convention) to compass bearing.
 * From-south: 0=S, +90=W, -90=E
 * Compass: 0=N, 90=E, 180=S, 270=W
 */
export function solarAzimuthToCompass(azFromSouth: number): number {
  let compass = 180 + azFromSouth;
  compass = ((compass % 360) + 360) % 360;
  return compass;
}

// ---------------------------------------------------------------------------
// 5b: Shadow projection and height constraint
// ---------------------------------------------------------------------------

/**
 * Calculate the shadow tip position projected on the ground.
 *
 * @param point - Base point of the building element (2D ground position)
 * @param height - Height of the building element above measurement plane
 * @param sunAltDeg - Sun altitude in degrees
 * @param sunAzCompassDeg - Sun azimuth in compass degrees (0=N, 90=E)
 * @param northRotation - Coordinate system rotation (delta), 0 for standard
 * @returns Shadow tip position in 2D coordinates
 */
export function shadowTip(
  point: Point2D,
  height: number,
  sunAltDeg: number,
  sunAzCompassDeg: number,
  northRotation: number,
): Point2D {
  if (sunAltDeg <= 0) {
    // Sun below horizon — shadow extends to infinity; return very far point
    return { x: point.x, y: point.y + 1000 };
  }

  const sunAltRad = (sunAltDeg * Math.PI) / 180;
  const shadowLength = height / Math.tan(sunAltRad);

  // Shadow falls opposite to the sun direction
  // Sun compass bearing → shadow direction = sunBearing + 180
  const shadowCompassDeg = sunAzCompassDeg + 180;

  // Convert compass bearing to coordinate angle (accounting for rotation)
  // From edgeCompassBearing: compass = (PI/2 + delta) - mathAngle
  // So: mathAngle = (PI/2 + delta) - compass
  const shadowCompassRad = (shadowCompassDeg * Math.PI) / 180;
  const mathAngle = (Math.PI / 2 + northRotation) - shadowCompassRad;

  return {
    x: point.x + shadowLength * Math.cos(mathAngle),
    y: point.y + shadowLength * Math.sin(mathAngle),
  };
}

/**
 * Calculate the maximum building height at a grid point that satisfies
 * shadow regulation constraints.
 *
 * The shadow regulation limits how many hours of shadow can fall
 * beyond the 5m and 10m measurement lines from the site boundary.
 *
 * Algorithm: For each time step on the winter solstice (8:00-16:00),
 * compute the maximum height such that the shadow tip doesn't violate
 * the time limits at 5m and 10m measurement distances.
 *
 * @param point - Grid point to evaluate
 * @param siteVertices - Site boundary polygon
 * @param shadowReg - Shadow regulation parameters
 * @param latitude - Observer latitude
 * @param northRotation - Coordinate rotation offset (0 = standard)
 * @returns Maximum allowed height at this point, or Infinity if no constraint
 */
export function calculateShadowConstrainedHeight(
  point: Point2D,
  siteVertices: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
): number {
  // Shadow regulation is evaluated on winter solstice (Dec 22)
  const MONTH = 12;
  const DAY = 22;
  const START_HOUR = 8;
  const END_HOUR = 16;
  const TIME_STEP = 10; // minutes — finer granularity for strict evaluation

  const effectiveHeight = shadowReg.measurementHeight;

  // Pre-compute solar positions for all time steps
  interface TimeStep {
    altitude: number;
    azimuthCompass: number;
  }

  const timeSteps: TimeStep[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (let m = 0; m < 60; m += TIME_STEP) {
      if (h === END_HOUR && m > 0) break;
      const sun = solarPosition(latitude, MONTH, DAY, h, m);
      if (sun.altitude <= 0) continue;
      const azCompass = solarAzimuthToCompass(sun.azimuth);
      timeSteps.push({ altitude: sun.altitude, azimuthCompass: azCompass });
    }
  }

  if (timeSteps.length === 0) return Infinity;

  const n = siteVertices.length;

  // If the point is very close to boundary, shadow regulation is very restrictive
  let minDistToBoundary = Infinity;
  for (let i = 0; i < n; i++) {
    const d = distanceToSegment(point, siteVertices[i], siteVertices[(i + 1) % n]);
    if (d < minDistToBoundary) minDistToBoundary = d;
  }
  if (minDistToBoundary < 0.1) return effectiveHeight;

  const timeStepHours = TIME_STEP / 60;

  // Binary search for max height
  let lo = effectiveHeight;
  let hi = 100;

  for (let iter = 0; iter < 40; iter++) {
    const mid = (lo + hi) / 2;
    const { hours5m, hours10m } = countShadowHours(
      mid, effectiveHeight, timeSteps, northRotation, siteVertices, point, n, timeStepHours,
    );

    if (hours5m <= shadowReg.maxHoursAt5m && hours10m <= shadowReg.maxHoursAt10m) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Count shadow hours at 5m and 10m measurement lines for a given building height.
 *
 * Uses perpendicular distance from the shadow tip to the nearest boundary edge,
 * which is stricter than the previous along-ray distance approach (especially
 * for oblique shadow angles where along-ray overestimates the allowed distance).
 */
function countShadowHours(
  buildingHeight: number,
  measurementHeight: number,
  timeSteps: { altitude: number; azimuthCompass: number }[],
  northRotation: number,
  siteVertices: Point2D[],
  point: Point2D,
  n: number,
  timeStepHours: number,
): { hours5m: number; hours10m: number } {
  let hours5m = 0;
  let hours10m = 0;

  const effectiveH = buildingHeight - measurementHeight;
  if (effectiveH <= 0) return { hours5m: 0, hours10m: 0 };

  for (const ts of timeSteps) {
    const sunAltRad = (ts.altitude * Math.PI) / 180;
    const shadowLength = effectiveH / Math.tan(sunAltRad);

    // Shadow direction
    const shadowCompassDeg = ts.azimuthCompass + 180;
    const shadowCompassRad = (shadowCompassDeg * Math.PI) / 180;
    const mathAngle = (Math.PI / 2 + northRotation) - shadowCompassRad;

    // Compute actual shadow tip position
    const tip: Point2D = {
      x: point.x + shadowLength * Math.cos(mathAngle),
      y: point.y + shadowLength * Math.sin(mathAngle),
    };

    // If shadow tip is inside the site, it doesn't cross any measurement line
    if (isInsidePolygon(tip, siteVertices)) continue;

    // Shadow tip is outside the site boundary.
    // Compute perpendicular distance from shadow tip to nearest boundary edge.
    // This is stricter than along-ray distance for oblique shadow angles.
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = distanceToSegment(tip, siteVertices[i], siteVertices[(i + 1) % n]);
      if (d < minDist) minDist = d;
    }

    // Shadow beyond 5m measurement line
    if (minDist >= 5) {
      hours5m += timeStepHours;
    }
    // Shadow beyond 10m measurement line
    if (minDist >= 10) {
      hours10m += timeStepHours;
    }
  }

  return { hours5m, hours10m };
}

