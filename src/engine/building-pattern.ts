import type {
  Point2D,
  VolumeInput,
  HeightFieldData,
  ShadowRegulation,
  PatternResult,
  BuildingPatternResult,
} from './types';
import { solarPosition, solarAzimuthToCompass } from './shadow';
import { distanceToSegment, isInsidePolygon, polygonArea } from './geometry';
import { applyWallSetback } from './wall-setback';
import { getAbsoluteHeightLimit } from './absolute-height';
import { isReceptorInShadow } from './shadow-projection';
import { isSimplePolygon } from './geometry';
import { MAX_HEIGHT_CAP } from './constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Coarser analysis grid improves runtime significantly while keeping trend-level comparisons stable.
const BUILDING_GRID_RESOLUTION = 1.0;
const RECEPTOR_GRID_RESOLUTION = 3.0;
const RECEPTOR_GRID_PADDING = 15;
const FLOOR_HEIGHT = 3.0;
const FLOOR_HEIGHT_EPS = 0.01;

/** Mid-high-rise pattern additional inset (meters) */
const MID_HIGH_RISE_INSET = 5.0;

// ---------------------------------------------------------------------------
// HeightFieldData builder for a uniform-height footprint
// ---------------------------------------------------------------------------

interface UniformHeightFieldTemplate {
  cols: number;
  rows: number;
  originX: number;
  originY: number;
  resolution: number;
  total: number;
  insideMask: Uint8Array;
  insideIndices: Uint32Array;
}

function buildUniformHeightFieldTemplate(
  footprint: Point2D[],
): UniformHeightFieldTemplate {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of footprint) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / BUILDING_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / BUILDING_GRID_RESOLUTION) + 1);
  const total = rows * cols;
  const insideMask = new Uint8Array(total);
  const insideIndices: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const pt: Point2D = {
        x: minX + col * BUILDING_GRID_RESOLUTION,
        y: minY + row * BUILDING_GRID_RESOLUTION,
      };
      if (isInsidePolygon(pt, footprint)) {
        insideMask[idx] = 1;
        insideIndices.push(idx);
      }
    }
  }

  return {
    cols,
    rows,
    originX: minX,
    originY: minY,
    resolution: BUILDING_GRID_RESOLUTION,
    total,
    insideMask,
    insideIndices: Uint32Array.from(insideIndices),
  };
}

function buildUniformHeightFieldFromTemplate(
  template: UniformHeightFieldTemplate,
  height: number,
): HeightFieldData {
  const heights = new Float32Array(template.total);
  for (let i = 0; i < template.insideIndices.length; i++) {
    heights[template.insideIndices[i]] = height;
  }

  return {
    cols: template.cols,
    rows: template.rows,
    originX: template.originX,
    originY: template.originY,
    resolution: template.resolution,
    heights,
    insideMask: template.insideMask,
  };
}

function buildUniformHeightField(
  footprint: Point2D[],
  height: number,
): HeightFieldData {
  const template = buildUniformHeightFieldTemplate(footprint);
  return buildUniformHeightFieldFromTemplate(template, height);
}

// ---------------------------------------------------------------------------
// Pre-computed solar time steps (winter solstice)
// ---------------------------------------------------------------------------

interface SolarTimeStep {
  altitude: number;
  azimuthCompass: number;
}

function precomputeSolarSteps(latitude: number): { steps: SolarTimeStep[]; timeStepHours: number } {
  const MONTH = 12, DAY = 22;
  const START_HOUR = 8, END_HOUR = 16, TIME_STEP = 10;
  const steps: SolarTimeStep[] = [];

  for (let h = START_HOUR; h <= END_HOUR; h++) {
    for (let m = 0; m < 60; m += TIME_STEP) {
      if (h === END_HOUR && m > 0) break;
      const sun = solarPosition(latitude, MONTH, DAY, h, m);
      if (sun.altitude <= 0) continue;
      steps.push({
        altitude: sun.altitude,
        azimuthCompass: solarAzimuthToCompass(sun.azimuth),
      });
    }
  }

  return { steps, timeStepHours: TIME_STEP / 60 };
}

// ---------------------------------------------------------------------------
// Pre-computed receptor points
// ---------------------------------------------------------------------------

interface ReceptorPoint {
  x: number;
  y: number;
  distToBoundary: number;
}

function buildReceptorGrid(measurementBoundary: Point2D[]): ReceptorPoint[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of measurementBoundary) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  minX -= RECEPTOR_GRID_PADDING;
  minY -= RECEPTOR_GRID_PADDING;
  maxX += RECEPTOR_GRID_PADDING;
  maxY += RECEPTOR_GRID_PADDING;

  const n = measurementBoundary.length;
  const receptors: ReceptorPoint[] = [];

  const cols = Math.max(1, Math.ceil((maxX - minX) / RECEPTOR_GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / RECEPTOR_GRID_RESOLUTION) + 1);

  for (let row = 0; row < rows; row++) {
    const ry = minY + row * RECEPTOR_GRID_RESOLUTION;
    for (let col = 0; col < cols; col++) {
      const rx = minX + col * RECEPTOR_GRID_RESOLUTION;
      const pt: Point2D = { x: rx, y: ry };

      if (isInsidePolygon(pt, measurementBoundary)) continue;

      // Compute distance to nearest boundary edge
      let minDist = Infinity;
      for (let i = 0; i < n; i++) {
        const d = distanceToSegment(
          pt,
          measurementBoundary[i],
          measurementBoundary[(i + 1) % n],
        );
        if (d < minDist) minDist = d;
      }

      // Only keep points within measurement range (5m-15m from boundary)
      if (minDist >= 4.5 && minDist <= RECEPTOR_GRID_PADDING) {
        receptors.push({ x: rx, y: ry, distToBoundary: minDist });
      }
    }
  }

  return receptors;
}

// ---------------------------------------------------------------------------
// Core: evaluate shadow compliance for a given footprint + height
// ---------------------------------------------------------------------------

export function evaluateShadowCompliance(
  footprint: Point2D[],
  height: number,
  measurementBoundary: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
): { passes: boolean; worstHoursAt5m: number; worstHoursAt10m: number } {
  const hf = buildUniformHeightField(footprint, height);
  const { steps, timeStepHours } = precomputeSolarSteps(latitude);
  const receptors = buildReceptorGrid(measurementBoundary);

  if (steps.length === 0 || receptors.length === 0) {
    return { passes: true, worstHoursAt5m: 0, worstHoursAt10m: 0 };
  }

  let worstAt5m = 0;
  let worstAt10m = 0;

  for (const r of receptors) {
    let hours = 0;
    for (const ts of steps) {
      if (
        isReceptorInShadow(
          r.x, r.y,
          shadowReg.measurementHeight,
          ts.altitude, ts.azimuthCompass,
          northRotation, hf,
        )
      ) {
        hours += timeStepHours;
      }
    }

    if (r.distToBoundary >= 5 && hours > worstAt5m) {
      worstAt5m = hours;
    }
    if (r.distToBoundary >= 10 && hours > worstAt10m) {
      worstAt10m = hours;
    }
  }

  const passes =
    worstAt5m <= shadowReg.maxHoursAt5m &&
    worstAt10m <= shadowReg.maxHoursAt10m;

  return { passes, worstHoursAt5m: worstAt5m, worstHoursAt10m: worstAt10m };
}

// ---------------------------------------------------------------------------
// Find the minimum envelope height across a footprint
// ---------------------------------------------------------------------------

function getMinEnvelopeHeight(
  footprint: Point2D[],
  envelopeHF: HeightFieldData | null,
): number {
  if (!envelopeHF) return Infinity;

  let minH = Infinity;
  const { cols, rows, originX, originY, resolution, heights, insideMask } = envelopeHF;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) continue;

      const pt: Point2D = {
        x: originX + col * resolution,
        y: originY + row * resolution,
      };

      if (isInsidePolygon(pt, footprint) && heights[idx] < minH) {
        minH = heights[idx];
      }
    }
  }

  return minH;
}

interface ShadowEvalCache {
  receptors: ReceptorPoint[];
  steps: SolarTimeStep[];
  timeStepHours: number;
}

function buildShadowEvalCache(measurementBoundary: Point2D[], latitude: number): ShadowEvalCache {
  const receptors = buildReceptorGrid(measurementBoundary);
  const { steps, timeStepHours } = precomputeSolarSteps(latitude);
  return { receptors, steps, timeStepHours };
}

interface FindMaxHeightResult {
  maxHeight: number;
  maxFloors: number;
  footprintArea: number;
  totalFloorArea: number;
  compliance: { passes: boolean; worstHoursAt5m: number; worstHoursAt10m: number };
}

const FIND_MAX_HEIGHT_CACHE_LIMIT = 256;
const findMaxHeightCache = new Map<string, FindMaxHeightResult>();

function pointListKey(points: Point2D[]): string {
  return points
    .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
    .join(';');
}

function floorHeightsKey(floorHeights?: number[]): string {
  if (!floorHeights || floorHeights.length === 0) return '';
  return floorHeights.map((h) => h.toFixed(3)).join(',');
}

function makeFindMaxHeightCacheKey(
  footprint: Point2D[],
  measurementBoundary: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
  heightCap: number,
  floorHeights?: number[],
): string {
  return [
    pointListKey(footprint),
    pointListKey(measurementBoundary),
    shadowReg.measurementHeight.toFixed(3),
    shadowReg.maxHoursAt5m.toFixed(3),
    shadowReg.maxHoursAt10m.toFixed(3),
    latitude.toFixed(6),
    northRotation.toFixed(6),
    heightCap.toFixed(3),
    floorHeightsKey(floorHeights),
  ].join('|');
}

function cloneFindMaxHeightResult(result: FindMaxHeightResult): FindMaxHeightResult {
  return {
    ...result,
    compliance: { ...result.compliance },
  };
}

function rememberFindMaxHeightResult(key: string, result: FindMaxHeightResult): void {
  if (findMaxHeightCache.size >= FIND_MAX_HEIGHT_CACHE_LIMIT) {
    const firstKey = findMaxHeightCache.keys().next().value;
    if (firstKey) {
      findMaxHeightCache.delete(firstKey);
    }
  }
  findMaxHeightCache.set(key, cloneFindMaxHeightResult(result));
}

function computeMaxFloors(maxHeight: number, floorHeights?: number[]): number {
  if (!Number.isFinite(maxHeight) || maxHeight <= 0) return 0;
  if (!floorHeights || floorHeights.length === 0) {
    return Math.floor(maxHeight / FLOOR_HEIGHT);
  }

  let count = 0;
  let cumulative = 0;
  for (const fh of floorHeights) {
    cumulative += fh;
    if (cumulative <= maxHeight + FLOOR_HEIGHT_EPS) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Footprint validation helpers (for large insets)
// ---------------------------------------------------------------------------

const INSET_VALIDATION_EPS = 1e-4;

function polygonSignedArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function isPointInsideOrOnBoundary(point: Point2D, polygon: Point2D[]): boolean {
  if (isInsidePolygon(point, polygon)) return true;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const d = distanceToSegment(point, polygon[i], polygon[(i + 1) % n]);
    if (d <= INSET_VALIDATION_EPS) return true;
  }
  return false;
}

function isInsetFootprintValid(base: Point2D[], inset: Point2D[]): boolean {
  if (inset.length < 3) return false;
  if (!isSimplePolygon(inset)) return false;

  const baseSigned = polygonSignedArea(base);
  const insetSigned = polygonSignedArea(inset);
  if (Math.abs(baseSigned) < 1e-8 || Math.abs(insetSigned) < 1e-8) return false;
  if (Math.sign(baseSigned) !== Math.sign(insetSigned)) return false;

  const baseArea = Math.abs(baseSigned);
  const insetArea = Math.abs(insetSigned);
  if (insetArea >= baseArea - 1e-6) return false;

  for (let i = 0; i < inset.length; i++) {
    const a = inset[i];
    const b = inset[(i + 1) % inset.length];
    if (!isPointInsideOrOnBoundary(a, base)) return false;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (!isPointInsideOrOnBoundary(mid, base)) return false;
  }

  return true;
}

function getInsetUpperBound(base: Point2D[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of base) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  const minDim = Math.min(maxX - minX, maxY - minY);
  return Math.max(0, minDim / 2 - 0.01);
}

function chooseBetterPattern(a: PatternResult | null, b: PatternResult | null): PatternResult | null {
  if (!a) return b;
  if (!b) return a;
  if (b.totalFloorArea > a.totalFloorArea + 1e-6) return b;
  if (Math.abs(b.totalFloorArea - a.totalFloorArea) <= 1e-6) {
    if (b.maxHeight > a.maxHeight + 1e-6) return b;
    if (Math.abs(b.maxHeight - a.maxHeight) <= 1e-6) {
      const aInset = a.inset ?? 0;
      const bInset = b.inset ?? 0;
      if (bInset < aInset) return b;
    }
  }
  return a;
}

function buildPatternResult(
  name: string,
  footprint: Point2D[],
  inset: number,
  result: {
    maxHeight: number;
    maxFloors: number;
    footprintArea: number;
    totalFloorArea: number;
    compliance: { passes: boolean; worstHoursAt5m: number; worstHoursAt10m: number };
  },
): PatternResult {
  return {
    name,
    footprint,
    inset,
    maxHeight: result.maxHeight,
    maxFloors: result.maxFloors,
    footprintArea: result.footprintArea,
    totalFloorArea: result.totalFloorArea,
    compliance: result.compliance,
  };
}

// ---------------------------------------------------------------------------
// Binary search: find max height for a pattern
// ---------------------------------------------------------------------------

export function findMaxHeightForPattern(
  footprint: Point2D[],
  measurementBoundary: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
  heightCap: number,
  floorHeights?: number[],
): {
  maxHeight: number;
  maxFloors: number;
  footprintArea: number;
  totalFloorArea: number;
  compliance: { passes: boolean; worstHoursAt5m: number; worstHoursAt10m: number };
} {
  const cacheKey = makeFindMaxHeightCacheKey(
    footprint,
    measurementBoundary,
    shadowReg,
    latitude,
    northRotation,
    heightCap,
    floorHeights,
  );
  const cached = findMaxHeightCache.get(cacheKey);
  if (cached) {
    return cloneFindMaxHeightResult(cached);
  }

  const cache = buildShadowEvalCache(measurementBoundary, latitude);
  const result = findMaxHeightForPatternWithCache(
    footprint,
    shadowReg,
    northRotation,
    heightCap,
    cache,
    floorHeights,
  );
  rememberFindMaxHeightResult(cacheKey, result);
  return cloneFindMaxHeightResult(result);
}

function findMaxHeightForPatternWithCache(
  footprint: Point2D[],
  shadowReg: ShadowRegulation,
  northRotation: number,
  heightCap: number,
  cache: ShadowEvalCache,
  floorHeights?: number[],
): FindMaxHeightResult {
  const area = polygonArea(footprint);
  const roundedArea = Math.round(area * 100) / 100;
  const cap = Math.min(Math.max(heightCap, 0), MAX_HEIGHT_CAP);

  if (footprint.length < 3 || area <= 0 || cap <= 0) {
    return {
      maxHeight: 0,
      maxFloors: 0,
      footprintArea: roundedArea,
      totalFloorArea: 0,
      compliance: { passes: false, worstHoursAt5m: 0, worstHoursAt10m: 0 },
    };
  }

  const { receptors, steps, timeStepHours } = cache;
  const template = buildUniformHeightFieldTemplate(footprint);

  // Inner evaluation (avoids rebuilding receptors/steps)
  function evalAtHeight(h: number): { passes: boolean; worstHoursAt5m: number; worstHoursAt10m: number } {
    const hf = buildUniformHeightFieldFromTemplate(template, h);

    if (steps.length === 0 || receptors.length === 0) {
      return { passes: true, worstHoursAt5m: 0, worstHoursAt10m: 0 };
    }

    let worstAt5m = 0;
    let worstAt10m = 0;

    for (const r of receptors) {
      let hours = 0;
      for (const ts of steps) {
        if (
          isReceptorInShadow(
            r.x, r.y,
            shadowReg.measurementHeight,
            ts.altitude, ts.azimuthCompass,
            northRotation, hf,
          )
        ) {
          hours += timeStepHours;
        }
      }

      if (r.distToBoundary >= 5 && hours > worstAt5m) {
        worstAt5m = hours;
      }
      if (r.distToBoundary >= 10 && hours > worstAt10m) {
        worstAt10m = hours;
      }
    }

    const passes =
      worstAt5m <= shadowReg.maxHoursAt5m &&
      worstAt10m <= shadowReg.maxHoursAt10m;

    return { passes, worstHoursAt5m: worstAt5m, worstHoursAt10m: worstAt10m };
  }

  function evalPassAtHeight(h: number): boolean {
    const hf = buildUniformHeightFieldFromTemplate(template, h);

    if (steps.length === 0 || receptors.length === 0) {
      return true;
    }

    for (const r of receptors) {
      const limit =
        r.distToBoundary >= 10
          ? Math.min(shadowReg.maxHoursAt5m, shadowReg.maxHoursAt10m)
          : r.distToBoundary >= 5
            ? shadowReg.maxHoursAt5m
            : Infinity;

      if (!Number.isFinite(limit)) continue;

      let hours = 0;
      for (const ts of steps) {
        if (
          isReceptorInShadow(
            r.x, r.y,
            shadowReg.measurementHeight,
            ts.altitude, ts.azimuthCompass,
            northRotation, hf,
          )
        ) {
          hours += timeStepHours;
          if (hours > limit + 1e-9) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function floorToCentimeter(value: number): number {
    return Math.max(0, Math.floor(value * 100) / 100);
  }

  // Binary search
  let lo = 0;
  let hi = cap;

  if (cap <= shadowReg.measurementHeight) {
    const compliance = evalAtHeight(cap);
    const floors = computeMaxFloors(cap, floorHeights);
    return {
      maxHeight: Math.round(cap * 100) / 100,
      maxFloors: floors,
      footprintArea: roundedArea,
      totalFloorArea: Math.round(area * floors * 100) / 100,
      compliance,
    };
  }

  // Quick check: if even the cap height passes, use it
  if (evalPassAtHeight(hi)) {
    const compliance = evalAtHeight(hi);
    const floors = computeMaxFloors(hi, floorHeights);
    return {
      maxHeight: Math.round(hi * 100) / 100,
      maxFloors: floors,
      footprintArea: roundedArea,
      totalFloorArea: Math.round(area * floors * 100) / 100,
      compliance,
    };
  }

  // Binary search: find max height that passes
  for (let iter = 0; iter < 30 && hi - lo > 0.01; iter++) {
    const mid = (lo + hi) / 2;
    if (evalPassAtHeight(mid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  let maxHeight = floorToCentimeter(lo);
  let compliance = evalAtHeight(maxHeight);
  while (maxHeight > 0 && !compliance.passes) {
    maxHeight = floorToCentimeter(maxHeight - 0.01);
    compliance = evalAtHeight(maxHeight);
  }

  const maxFloors = computeMaxFloors(maxHeight, floorHeights);

  return {
    maxHeight,
    maxFloors,
    footprintArea: roundedArea,
    totalFloorArea: Math.round(area * maxFloors * 100) / 100,
    compliance,
  };
}

function findOptimalInsetPattern(
  baseFootprint: Point2D[],
  shadowReg: ShadowRegulation,
  northRotation: number,
  absLimit: number,
  envelopeHF: HeightFieldData | null,
  cache: ShadowEvalCache,
  floorHeights?: number[],
): PatternResult {
  const maxInset = getInsetUpperBound(baseFootprint);
  const coarseStep = 0.5;
  const fineStep = 0.1;

  const evaluateInset = (inset: number): PatternResult | null => {
    const footprint = inset <= 1e-6 ? baseFootprint : applyWallSetback(baseFootprint, inset);
    const valid = inset <= 1e-6 ? true : isInsetFootprintValid(baseFootprint, footprint);
    if (!valid) return null;

    const area = polygonArea(footprint);
    if (area <= 0.5) return null;

    const envelopeCap = getMinEnvelopeHeight(footprint, envelopeHF);
    const heightCap = Math.min(absLimit, envelopeCap);
    const result = findMaxHeightForPatternWithCache(
      footprint,
      shadowReg,
      northRotation,
      heightCap,
      cache,
      floorHeights,
    );

    return buildPatternResult('最適パターン', footprint, inset, result);
  };

  let best: PatternResult | null = null;
  for (let inset = 0; inset <= maxInset + 1e-6; inset += coarseStep) {
    best = chooseBetterPattern(best, evaluateInset(inset));
  }

  if (best) {
    const center = best.inset ?? 0;
    const start = Math.max(0, center - coarseStep);
    const end = Math.min(maxInset, center + coarseStep);
    for (let inset = start; inset <= end + 1e-6; inset += fineStep) {
      best = chooseBetterPattern(best, evaluateInset(inset));
    }
  }

  if (!best) {
    const envelopeCap = getMinEnvelopeHeight(baseFootprint, envelopeHF);
    const heightCap = Math.min(absLimit, envelopeCap);
    const fallback = findMaxHeightForPatternWithCache(
      baseFootprint,
      shadowReg,
      northRotation,
      heightCap,
      cache,
      floorHeights,
    );
    best = buildPatternResult('最適パターン', baseFootprint, 0, fallback);
  }

  return best;
}

// ---------------------------------------------------------------------------
// Main: generate both building patterns
// ---------------------------------------------------------------------------

export function generateBuildingPatterns(
  input: VolumeInput,
  buildablePolygon: Point2D[],
  measurementBoundary: Point2D[],
  northRotation: number,
  envelopeHF: HeightFieldData | null,
): BuildingPatternResult {
  const { zoning, latitude } = input;
  const shadowReg = zoning.shadowRegulation;
  const absLimit = getAbsoluteHeightLimit(zoning.absoluteHeightLimit);
  const shadowCache = shadowReg ? buildShadowEvalCache(measurementBoundary, latitude) : null;

  // --- Low-rise pattern: use full buildable polygon ---
  const lowRiseFootprint = buildablePolygon;
  const lowRiseEnvelopeCap = getMinEnvelopeHeight(lowRiseFootprint, envelopeHF);
  const lowRiseHeightCap = Math.min(absLimit, lowRiseEnvelopeCap);

  let lowRise: PatternResult;
  if (shadowReg) {
    const lr = findMaxHeightForPatternWithCache(
      lowRiseFootprint,
      shadowReg,
      northRotation,
      lowRiseHeightCap,
      shadowCache!,
      input.floorHeights,
    );
    lowRise = buildPatternResult('低層パターン', lowRiseFootprint, 0, lr);
  } else {
    // No shadow regulation: height is capped by envelope
    const area = polygonArea(lowRiseFootprint);
    const h = Math.round(Math.min(lowRiseHeightCap, MAX_HEIGHT_CAP) * 100) / 100;
    const floors = computeMaxFloors(h, input.floorHeights);
    lowRise = {
      name: '低層パターン',
      footprint: lowRiseFootprint,
      inset: 0,
      maxHeight: h,
      maxFloors: floors,
      footprintArea: Math.round(area * 100) / 100,
      totalFloorArea: Math.round(area * floors * 100) / 100,
      compliance: { passes: true, worstHoursAt5m: 0, worstHoursAt10m: 0 },
    };
  }

  // --- Mid-high-rise pattern: additional 5m inset ---
  const rawMidHighRiseFootprint = applyWallSetback(buildablePolygon, MID_HIGH_RISE_INSET);
  const midHighValid = isInsetFootprintValid(buildablePolygon, rawMidHighRiseFootprint);
  const midHighRiseFootprint = midHighValid ? rawMidHighRiseFootprint : [];
  const midHighArea = midHighValid ? polygonArea(midHighRiseFootprint) : 0;
  const midHighEnvelopeCap = midHighValid ? getMinEnvelopeHeight(midHighRiseFootprint, envelopeHF) : 0;
  const midHighHeightCap = Math.min(absLimit, midHighEnvelopeCap);

  let midHighRise: PatternResult;
  if (shadowReg && midHighValid && midHighArea > 1) {
    const mhr = findMaxHeightForPatternWithCache(
      midHighRiseFootprint,
      shadowReg,
      northRotation,
      midHighHeightCap,
      shadowCache!,
      input.floorHeights,
    );
    midHighRise = buildPatternResult('中高層パターン', midHighRiseFootprint, MID_HIGH_RISE_INSET, mhr);
  } else {
    // Footprint too small or no shadow regulation
    const area = midHighArea;
    const h = Math.round(Math.min(midHighHeightCap, MAX_HEIGHT_CAP) * 100) / 100;
    const floors = area > 0 ? computeMaxFloors(h, input.floorHeights) : 0;
    midHighRise = {
      name: '中高層パターン',
      footprint: midHighRiseFootprint,
      inset: MID_HIGH_RISE_INSET,
      maxHeight: area > 0 ? h : 0,
      maxFloors: floors,
      footprintArea: Math.round(area * 100) / 100,
      totalFloorArea: Math.round(area * floors * 100) / 100,
      compliance: { passes: area > 0 && midHighValid, worstHoursAt5m: 0, worstHoursAt10m: 0 },
    };
  }
  const optimal = shadowReg && shadowCache
    ? findOptimalInsetPattern(
      buildablePolygon,
      shadowReg,
      northRotation,
      absLimit,
      envelopeHF,
      shadowCache,
      input.floorHeights,
    )
    : lowRise;

  return { lowRise, midHighRise, optimal };
}
