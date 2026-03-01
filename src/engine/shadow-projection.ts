import type { Point2D, ShadowRegulation, HeightFieldData, ShadowGridData, ShadowProjectionResult } from './types';
import { solarPosition, solarAzimuthToCompass } from './shadow';
import { MAX_HEIGHT_CAP } from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHADOW_GRID_RESOLUTION = 1.0; // 1m resolution for shadow analysis grid
const SHADOW_GRID_PADDING = 15; // extend grid 15m beyond site boundary

// ---------------------------------------------------------------------------
// Core ray-tracing shadow detection
// ---------------------------------------------------------------------------

/**
 * Check if a receptor point on the measurement plane is in shadow.
 *
 * Traces a ray from the receptor TOWARD the sun. If the ray intersects
 * the building volume (height field), the receptor is in shadow.
 */
export function isReceptorInShadow(
  rx: number,
  ry: number,
  measurementHeight: number,
  sunAltDeg: number,
  sunAzCompassDeg: number,
  northRotation: number,
  hf: HeightFieldData,
): boolean {
  if (sunAltDeg <= 0) return false;

  const sunAltRad = (sunAltDeg * Math.PI) / 180;
  const tanAlt = Math.tan(sunAltRad);

  // Direction toward sun on the ground plane
  const sunCompassRad = (sunAzCompassDeg * Math.PI) / 180;
  const mathAngle = Math.PI / 2 + northRotation - sunCompassRad;
  const dirX = Math.cos(mathAngle);
  const dirY = Math.sin(mathAngle);

  const step = hf.resolution;
  const maxDist = 200; // meters — buildings beyond this are irrelevant

  for (let d = step; d <= maxDist; d += step) {
    const px = rx + d * dirX;
    const py = ry + d * dirY;

    // Map to height field grid indices
    const col = Math.round((px - hf.originX) / hf.resolution);
    const row = Math.round((py - hf.originY) / hf.resolution);

    if (col < 0 || col >= hf.cols || row < 0 || row >= hf.rows) continue;

    const idx = row * hf.cols + col;
    if (hf.insideMask[idx] === 0) continue;

    const buildingH = hf.heights[idx];
    const rayH = measurementHeight + d * tanAlt;

    if (buildingH > rayH) return true;
    if (rayH > MAX_HEIGHT_CAP) break; // ray is above any possible building
  }

  return false;
}

// ---------------------------------------------------------------------------
// Shadow grid computation
// ---------------------------------------------------------------------------

/**
 * Generate shadow projection data from the building envelope height field.
 *
 * Creates an equal-time shadow grid (等時間日影図) by ray-tracing each
 * receptor point on a ground grid for every 10-minute interval on the
 * winter solstice (Dec 22, 8:00–16:00).
 */
export function generateShadowProjection(
  heightField: HeightFieldData,
  siteVertices: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
): ShadowProjectionResult {
  // Bounding box of site + padding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of siteVertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  minX -= SHADOW_GRID_PADDING;
  minY -= SHADOW_GRID_PADDING;
  maxX += SHADOW_GRID_PADDING;
  maxY += SHADOW_GRID_PADDING;

  const cols = Math.max(1, Math.ceil((maxX - minX) / SHADOW_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / SHADOW_GRID_RESOLUTION) + 1);

  // Pre-compute solar positions for winter solstice
  const MONTH = 12, DAY = 22;
  const START_HOUR = 8, END_HOUR = 16, TIME_STEP = 10;

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
      timeSteps.push({
        altitude: sun.altitude,
        azimuthCompass: solarAzimuthToCompass(sun.azimuth),
      });
    }
  }

  const timeStepHours = TIME_STEP / 60;
  const hours = new Float32Array(rows * cols);

  // For each receptor point, count shadow hours
  for (let row = 0; row < rows; row++) {
    const ry = minY + row * SHADOW_GRID_RESOLUTION;
    for (let col = 0; col < cols; col++) {
      const rx = minX + col * SHADOW_GRID_RESOLUTION;
      const idx = row * cols + col;

      let totalHours = 0;
      for (const ts of timeSteps) {
        if (
          isReceptorInShadow(
            rx, ry,
            shadowReg.measurementHeight,
            ts.altitude, ts.azimuthCompass,
            northRotation, heightField,
          )
        ) {
          totalHours += timeStepHours;
        }
      }
      hours[idx] = totalHours;
    }
  }

  const shadowGrid: ShadowGridData = {
    cols,
    rows,
    originX: minX,
    originY: minY,
    resolution: SHADOW_GRID_RESOLUTION,
    hours,
  };

  // Generate 5m and 10m measurement offset lines
  const line5m = generateOffsetLine(siteVertices, 5);
  const line10m = generateOffsetLine(siteVertices, 10);

  return { shadowGrid, line5m, line10m };
}

// ---------------------------------------------------------------------------
// Time-specific shadow mask
// ---------------------------------------------------------------------------

/**
 * Compute a shadow mask for a specific time.
 * Returns a Uint8Array where 1 = in shadow, 0 = not in shadow.
 * Grid dimensions match the shadow grid from generateShadowProjection.
 */
export function getShadowMaskAtTime(
  heightField: HeightFieldData,
  siteVertices: Point2D[],
  measurementHeight: number,
  latitude: number,
  northRotation: number,
  hour: number,
  minute: number,
): { mask: Uint8Array; cols: number; rows: number; originX: number; originY: number; resolution: number } {
  // Bounding box (same as generateShadowProjection)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of siteVertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  minX -= SHADOW_GRID_PADDING;
  minY -= SHADOW_GRID_PADDING;
  maxX += SHADOW_GRID_PADDING;
  maxY += SHADOW_GRID_PADDING;

  const cols = Math.max(1, Math.ceil((maxX - minX) / SHADOW_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / SHADOW_GRID_RESOLUTION) + 1);

  const sun = solarPosition(latitude, 12, 22, hour, minute);
  const mask = new Uint8Array(rows * cols);

  if (sun.altitude <= 0) return { mask, cols, rows, originX: minX, originY: minY, resolution: SHADOW_GRID_RESOLUTION };

  const azCompass = solarAzimuthToCompass(sun.azimuth);

  for (let row = 0; row < rows; row++) {
    const ry = minY + row * SHADOW_GRID_RESOLUTION;
    for (let col = 0; col < cols; col++) {
      const rx = minX + col * SHADOW_GRID_RESOLUTION;
      if (isReceptorInShadow(rx, ry, measurementHeight, sun.altitude, azCompass, northRotation, heightField)) {
        mask[row * cols + col] = 1;
      }
    }
  }

  return { mask, cols, rows, originX: minX, originY: minY, resolution: SHADOW_GRID_RESOLUTION };
}

// ---------------------------------------------------------------------------
// Offset line generation (for 5m / 10m measurement lines)
// ---------------------------------------------------------------------------

/**
 * Line-line intersection of two infinite lines defined by (p1→p2) and (p3→p4).
 */
function lineLineIntersection(
  p1: Point2D, p2: Point2D,
  p3: Point2D, p4: Point2D,
): Point2D | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null; // parallel
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/**
 * Generate an outward-offset polygon from site boundary.
 * Each edge is moved outward by `offset` meters, then adjacent
 * offset edges are intersected to form the offset polygon.
 */
function generateOffsetLine(vertices: Point2D[], offset: number): Point2D[] {
  const n = vertices.length;
  if (n < 3) return [];

  // Build offset edges
  const offsetEdges: { start: Point2D; end: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) continue;
    // Outward normal for CW winding: (dy, -dx) normalized
    const nx = (dy / len) * offset;
    const ny = (-dx / len) * offset;
    offsetEdges.push({
      start: { x: a.x + nx, y: a.y + ny },
      end: { x: b.x + nx, y: b.y + ny },
    });
  }

  if (offsetEdges.length < 2) return [];

  // Intersect adjacent offset edges to form vertices
  const result: Point2D[] = [];
  for (let i = 0; i < offsetEdges.length; i++) {
    const e1 = offsetEdges[i];
    const e2 = offsetEdges[(i + 1) % offsetEdges.length];
    const pt = lineLineIntersection(e1.start, e1.end, e2.start, e2.end);
    result.push(pt ?? e1.end);
  }

  return result;
}
