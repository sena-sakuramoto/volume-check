import type {
  Point2D,
  ShadowRegulation,
  HeightFieldData,
  ShadowGridData,
  ShadowProjectionResult,
} from './types';
import { solarPosition, solarAzimuthToCompass } from './shadow';
import { MAX_HEIGHT_CAP } from './constants';
import { offsetShadowBoundary } from './shadow-boundary';

const SHADOW_GRID_RESOLUTION = 1.0;
const SHADOW_GRID_PADDING = 15;

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
  const sunCompassRad = (sunAzCompassDeg * Math.PI) / 180;
  const mathAngle = Math.PI / 2 + northRotation - sunCompassRad;
  const dirX = Math.cos(mathAngle);
  const dirY = Math.sin(mathAngle);

  const step = hf.resolution;
  const maxDist = 200;

  for (let d = step; d <= maxDist; d += step) {
    const px = rx + d * dirX;
    const py = ry + d * dirY;

    const col = Math.round((px - hf.originX) / hf.resolution);
    const row = Math.round((py - hf.originY) / hf.resolution);

    if (col < 0 || col >= hf.cols || row < 0 || row >= hf.rows) continue;

    const idx = row * hf.cols + col;
    if (hf.insideMask[idx] === 0) continue;

    const buildingH = hf.heights[idx];
    const rayH = measurementHeight + d * tanAlt;

    if (buildingH > rayH) return true;
    if (rayH > MAX_HEIGHT_CAP) break;
  }

  return false;
}

function getShadowGridBounds(measurementBoundary: Point2D[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const vertex of measurementBoundary) {
    if (vertex.x < minX) minX = vertex.x;
    if (vertex.y < minY) minY = vertex.y;
    if (vertex.x > maxX) maxX = vertex.x;
    if (vertex.y > maxY) maxY = vertex.y;
  }

  return {
    minX: minX - SHADOW_GRID_PADDING,
    minY: minY - SHADOW_GRID_PADDING,
    maxX: maxX + SHADOW_GRID_PADDING,
    maxY: maxY + SHADOW_GRID_PADDING,
  };
}

export function generateShadowProjection(
  heightField: HeightFieldData,
  measurementBoundary: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
): ShadowProjectionResult {
  const { minX, minY, maxX, maxY } = getShadowGridBounds(measurementBoundary);
  const cols = Math.max(1, Math.ceil((maxX - minX) / SHADOW_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / SHADOW_GRID_RESOLUTION) + 1);

  const MONTH = 12;
  const DAY = 22;
  const START_HOUR = 8;
  const END_HOUR = 16;
  const TIME_STEP = 10;

  const timeSteps: Array<{ altitude: number; azimuthCompass: number }> = [];
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

  for (let row = 0; row < rows; row++) {
    const ry = minY + row * SHADOW_GRID_RESOLUTION;
    for (let col = 0; col < cols; col++) {
      const rx = minX + col * SHADOW_GRID_RESOLUTION;
      const idx = row * cols + col;

      let totalHours = 0;
      for (const ts of timeSteps) {
        if (
          isReceptorInShadow(
            rx,
            ry,
            shadowReg.measurementHeight,
            ts.altitude,
            ts.azimuthCompass,
            northRotation,
            heightField,
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

  return {
    shadowGrid,
    line5m: offsetShadowBoundary(measurementBoundary, 5),
    line10m: offsetShadowBoundary(measurementBoundary, 10),
  };
}

export function getShadowMaskAtTime(
  heightField: HeightFieldData,
  measurementBoundary: Point2D[],
  measurementHeight: number,
  latitude: number,
  northRotation: number,
  hour: number,
  minute: number,
): {
  mask: Uint8Array;
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  resolution: number;
} {
  const { minX, minY, maxX, maxY } = getShadowGridBounds(measurementBoundary);
  const cols = Math.max(1, Math.ceil((maxX - minX) / SHADOW_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / SHADOW_GRID_RESOLUTION) + 1);
  const mask = new Uint8Array(rows * cols);

  const sun = solarPosition(latitude, 12, 22, hour, minute);
  if (sun.altitude <= 0) {
    return { mask, cols, rows, originX: minX, originY: minY, resolution: SHADOW_GRID_RESOLUTION };
  }

  const azCompass = solarAzimuthToCompass(sun.azimuth);

  for (let row = 0; row < rows; row++) {
    const ry = minY + row * SHADOW_GRID_RESOLUTION;
    for (let col = 0; col < cols; col++) {
      const rx = minX + col * SHADOW_GRID_RESOLUTION;
      if (
        isReceptorInShadow(
          rx,
          ry,
          measurementHeight,
          sun.altitude,
          azCompass,
          northRotation,
          heightField,
        )
      ) {
        mask[row * cols + col] = 1;
      }
    }
  }

  return { mask, cols, rows, originX: minX, originY: minY, resolution: SHADOW_GRID_RESOLUTION };
}
