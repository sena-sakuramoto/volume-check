import type {
  Point2D,
  Road,
  RoadSetbackParams,
  AdjacentSetbackParams,
  NorthSetbackParams,
  VolumeInput,
  VolumeResult,
} from './types';
import { distanceToSegment, isInsidePolygon, isInsidePolygonOrBoundary } from './geometry';
import { calculateMaxCoverage } from './coverage';
import { calculateMaxFloorArea } from './floor-area';
import { getAbsoluteHeightLimit } from './absolute-height';
import {
  calculateRoadSetbackHeight,
  getRoadRequiredFrontSetback,
  getRoadSlopeSetbackRelief,
  getRoadSlopeEffectiveWidthsAtPoint,
} from './setback-road';
import { calculateAdjacentSetbackHeight } from './setback-adjacent';
import { calculateNorthSetbackHeight } from './setback-north';
import { calculateHeightDistrictLimit } from './height-district';
import { applyEdgeSetbacks } from './wall-setback';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
} from './zoning';
import { validateVolumeInput } from './validation';
import { calculateShadowConstrainedHeight } from './shadow';
import { generateShadowProjection } from './shadow-projection';
import { generateReverseShadow } from './reverse-shadow';
import { buildShadowBoundary } from './shadow-boundary';
import { generateBuildingPatterns } from './building-pattern';
import type { HeightFieldData, ShadowProjectionResult, ReverseShadowResult, BuildingPatternResult } from './types';
import { MAX_HEIGHT_CAP } from './constants';

/** Grid resolution in meters for sampling height field. 1m keeps planning-level trends with lower latency. */
const GRID_RESOLUTION = 1.0;
/** Target mesh resolution for rendering. Finer than analysis grid to reduce jagged surfaces. */
const RENDER_MESH_RESOLUTION = 0.25;
/** Safety cap to avoid excessive mesh point counts on very large sites. */
const MAX_RENDER_GRID_POINTS = 250_000;

/** Assumed floor height in meters for maxFloors estimation */
const FLOOR_HEIGHT = 3.0;

/** Threshold for classifying an edge as roughly horizontal (for north detection) */
const HORIZONTAL_THRESHOLD = 0.3; // radians (~17 degrees)

function getEffectiveAbsoluteHeightLimit(input: VolumeInput): number {
  const baseLimit = getAbsoluteHeightLimit(input.zoning.absoluteHeightLimit);
  const districtPlanLimit = input.zoning.districtPlan?.maxHeight ?? Infinity;
  return Math.min(baseLimit, districtPlanLimit, MAX_HEIGHT_CAP);
}

function signedArea(vertices: Point2D[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return area / 2;
}

function outwardNormalAngle(a: Point2D, b: Point2D, isCCW: boolean): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // CCW: outward normal = (-dy, dx), CW: outward normal = (dy, -dx)
  return isCCW ? Math.atan2(dx, -dy) : Math.atan2(-dx, dy);
}

// ---------------------------------------------------------------------------
// Edge classification helpers
// ---------------------------------------------------------------------------

export interface SiteEdge {
  start: Point2D;
  end: Point2D;
}

/**
 * Get all site boundary edges as segments.
 */
export function getSiteEdges(vertices: Point2D[]): SiteEdge[] {
  const edges: SiteEdge[] = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    edges.push({ start: vertices[i], end: vertices[(i + 1) % n] });
  }
  return edges;
}

/**
 * Determine whether a site edge coincides with a road edge.
 * Checks 3 sample points (start, midpoint, end) with 0.5m tolerance.
 * Requires at least 2 of 3 points to match for robustness against OCR errors.
 * Returns the matched Road or null.
 */
export function matchRoadEdge(edge: SiteEdge, roads: Road[]): Road | null {
  const samples: Point2D[] = [
    edge.start,
    { x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2 },
    edge.end,
  ];
  const TOLERANCE = 0.5;

  for (const road of roads) {
    let matchCount = 0;
    for (const pt of samples) {
      if (distanceToSegment(pt, road.edgeStart, road.edgeEnd) < TOLERANCE) {
        matchCount++;
      }
    }
    if (matchCount >= 2) return road;
  }
  return null;
}

/**
 * Legacy compatibility wrapper.
 * @deprecated Use matchRoadEdge() instead for the matched Road object.
 */
export function isRoadEdge(edge: SiteEdge, roads: Road[]): boolean {
  return matchRoadEdge(edge, roads) !== null;
}

/**
 * Compute the coordinate system rotation offset (delta).
 *
 * Compass bearings go clockwise (0=N, 90=E), math angles go counterclockwise.
 * The relationship is: compassBearing = (PI/2 + delta) - mathAngle
 * where delta is the rotation of the coordinate system.
 *
 * From a road with known compass bearing B and observed outward normal math angle θ:
 *   delta = B + θ - PI/2
 *
 * For standard orientation (north=+Y): delta = 0.
 *
 * Returns delta in radians, or null if no bearing info is available.
 */
export function computeNorthRotation(roads: Road[], siteVertices: Point2D[]): number | null {
  const deltas: number[] = [];
  const isCCW = signedArea(siteVertices) > 0;

  for (const road of roads) {
    const bearingRad = (road.bearing * Math.PI) / 180;
    const coordAngle = outwardNormalAngle(road.edgeStart, road.edgeEnd, isCCW);
    const delta = bearingRad + coordAngle - Math.PI / 2;
    deltas.push(delta);
  }

  if (deltas.length === 0) return null;

  // Circular mean
  let sinSum = 0, cosSum = 0;
  for (const d of deltas) {
    sinSum += Math.sin(d);
    cosSum += Math.cos(d);
  }
  return Math.atan2(sinSum / deltas.length, cosSum / deltas.length);
}

/**
 * Get the compass bearing (0=N, 90=E, etc.) of an edge's outward normal,
 * given the coordinate system rotation offset (delta).
 *
 * Formula: compassBearing = (PI/2 + delta) - mathAngle
 */
export function edgeCompassBearing(edge: SiteEdge, delta: number, isCCW: boolean): number {
  const coordAngle = outwardNormalAngle(edge.start, edge.end, isCCW);
  let bearing = (Math.PI / 2 + delta) - coordAngle;
  // Normalize to [0, 2*PI)
  bearing = ((bearing % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return (bearing * 180) / Math.PI; // degrees
}

/**
 * Identify north-facing boundary edges.
 *
 * If road bearings are available, uses compass-based detection:
 * edges whose outward normal bearing is between 315° and 45° (north sector).
 *
 * Falls back to Y-coordinate heuristic when no bearing data is available.
 */
export function getNorthEdges(
  nonRoadEdges: SiteEdge[],
  vertices: Point2D[],
  roads?: Road[],
): SiteEdge[] {
  if (nonRoadEdges.length === 0) return [];
  const isCCW = signedArea(vertices) > 0;

  // Try compass-based detection if roads have bearing info
  if (roads && roads.length > 0) {
    const northRotation = computeNorthRotation(roads, vertices);
    if (northRotation !== null) {
      const northEdges: SiteEdge[] = [];
      for (const edge of nonRoadEdges) {
        const bearing = edgeCompassBearing(edge, northRotation, isCCW);
        // North sector: 315° to 45° (i.e., bearing > 315 or bearing < 45)
        if (bearing >= 315 || bearing <= 45) {
          northEdges.push(edge);
        }
      }
      if (northEdges.length > 0) return northEdges;
      // If compass detection found nothing, fall through to heuristic
    }
  }

  // Fallback: Y-coordinate heuristic (original algorithm)
  return getNorthEdgesHeuristic(nonRoadEdges, vertices);
}

/**
 * Original Y-coordinate based north edge detection (fallback).
 */
function getNorthEdgesHeuristic(
  nonRoadEdges: SiteEdge[],
  vertices: Point2D[],
): SiteEdge[] {
  const allY = vertices.map((v) => v.y);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const yRange = maxY - minY;

  const yThreshold = yRange > 0 ? maxY - yRange * 0.25 : minY;

  const northEdges: SiteEdge[] = [];
  for (const edge of nonRoadEdges) {
    const midY = (edge.start.y + edge.end.y) / 2;
    if (midY < yThreshold) continue;

    const dx = edge.end.x - edge.start.x;
    const dy = edge.end.y - edge.start.y;
    const angle = Math.abs(Math.atan2(dy, dx));
    if (angle < HORIZONTAL_THRESHOLD || Math.abs(angle - Math.PI) < HORIZONTAL_THRESHOLD) {
      northEdges.push(edge);
    }
  }

  if (northEdges.length === 0 && nonRoadEdges.length > 0) {
    let bestEdge = nonRoadEdges[0];
    let bestY = (bestEdge.start.y + bestEdge.end.y) / 2;
    for (let i = 1; i < nonRoadEdges.length; i++) {
      const my = (nonRoadEdges[i].start.y + nonRoadEdges[i].end.y) / 2;
      if (my > bestY) {
        bestY = my;
        bestEdge = nonRoadEdges[i];
      }
    }
    northEdges.push(bestEdge);
  }

  return northEdges;
}

// ---------------------------------------------------------------------------
// Height field computation
// ---------------------------------------------------------------------------

interface HeightField {
  /** Number of columns (x direction) */
  cols: number;
  /** Number of rows (y direction) */
  rows: number;
  /** Grid spacing in meters */
  resolution: number;
  /** Height values, row-major [row * cols + col] */
  heights: Float32Array;
  /** Grid origin (min x, min y of bounding box) */
  originX: number;
  originY: number;
  /** Boolean mask: true if point is inside the buildable polygon */
  insideMask: Uint8Array;
}

interface EnvelopeRestrictionContext {
  input: VolumeInput;
  roads: Road[];
  adjacentEdges: SiteEdge[];
  northEdges: SiteEdge[];
  shadowBoundary: Point2D[] | null;
  northRotation: number;
  roadParams: RoadSetbackParams;
  adjParams: AdjacentSetbackParams;
  northParams: NorthSetbackParams | null;
  absLimit: number;
}

function evaluateRoadRestrictionHeight(
  point: Point2D,
  roads: Road[],
  roadParams: RoadSetbackParams,
  roadFacingWallSetback: number,
): number {
  let h = Infinity;
  const effectiveWidths = getRoadSlopeEffectiveWidthsAtPoint(
    point,
    roads,
    roadParams.applicationDistance,
  );
  for (let i = 0; i < roads.length; i++) {
    const road = roads[i];
    const roadH = calculateRoadSetbackHeight(
      point,
      road,
      roadParams.slopeRatio,
      roadParams.applicationDistance,
      {
        effectiveRoadWidth: effectiveWidths[i],
        setbackRelief: getRoadSlopeSetbackRelief(road, roadFacingWallSetback),
      },
    );
    if (roadH < h) h = roadH;
  }
  return h;
}

function getEffectiveWallSetback(zoning: VolumeInput['zoning']): number {
  return Math.max(0, zoning.wallSetback ?? 0, zoning.districtPlan?.wallSetback ?? 0);
}

function buildSiteEdgeSetbacks(
  vertices: Point2D[],
  roads: Road[],
  wallSetback: number | null,
  districtPlanWallSetback?: number,
): number[] {
  const baseSetback = Math.max(0, wallSetback ?? 0, districtPlanWallSetback ?? 0);
  const siteEdges = getSiteEdges(vertices);
  return siteEdges.map((edge) => {
    const matchedRoad = matchRoadEdge(edge, roads);
    const roadSetback = matchedRoad ? getRoadRequiredFrontSetback(matchedRoad) : 0;
    return baseSetback + roadSetback;
  });
}

function evaluateAdjacentRestrictionHeight(
  point: Point2D,
  adjacentEdges: SiteEdge[],
  adjParams: AdjacentSetbackParams,
): number {
  let h = Infinity;
  for (const edge of adjacentEdges) {
    const adjH = calculateAdjacentSetbackHeight(
      point,
      edge.start,
      edge.end,
      adjParams.riseHeight,
      adjParams.slopeRatio,
    );
    if (adjH < h) h = adjH;
  }
  return h;
}

function evaluateNorthRestrictionHeight(
  point: Point2D,
  northEdges: SiteEdge[],
  northParams: NorthSetbackParams | null,
): number {
  if (northParams === null || northEdges.length === 0) return Infinity;

  let h = Infinity;
  for (const edge of northEdges) {
    const northH = calculateNorthSetbackHeight(
      point,
      edge.start,
      edge.end,
      northParams.riseHeight,
      northParams.slopeRatio,
    );
    if (northH < h) h = northH;
  }
  return h;
}

function evaluateHeightDistrictRestrictionHeight(
  point: Point2D,
  context: EnvelopeRestrictionContext,
): number {
  if (context.input.zoning.heightDistrict.type === '指定なし') return Infinity;

  let h = Infinity;
  for (const edge of context.adjacentEdges) {
    const hdH = calculateHeightDistrictLimit(
      point,
      edge.start,
      edge.end,
      context.input.zoning.heightDistrict,
    );
    if (hdH < h) h = hdH;
  }
  for (const edge of context.northEdges) {
    const hdH = calculateHeightDistrictLimit(
      point,
      edge.start,
      edge.end,
      context.input.zoning.heightDistrict,
    );
    if (hdH < h) h = hdH;
  }
  return h;
}

function evaluateEnvelopeHeightAtPoint(
  point: Point2D,
  context: EnvelopeRestrictionContext,
  includeShadow: boolean,
): number {
  let h = context.absLimit;

  const roadH = evaluateRoadRestrictionHeight(
    point,
    context.roads,
    context.roadParams,
    getEffectiveWallSetback(context.input.zoning),
  );
  if (roadH < h) h = roadH;

  const adjacentH = evaluateAdjacentRestrictionHeight(point, context.adjacentEdges, context.adjParams);
  if (adjacentH < h) h = adjacentH;

  const northH = evaluateNorthRestrictionHeight(point, context.northEdges, context.northParams);
  if (northH < h) h = northH;

  const districtH = evaluateHeightDistrictRestrictionHeight(point, context);
  if (districtH < h) h = districtH;

  if (includeShadow && context.input.zoning.shadowRegulation !== null) {
    const shadowH = calculateShadowConstrainedHeight(
      point,
      context.shadowBoundary ?? context.input.site.vertices,
      context.input.zoning.shadowRegulation,
      context.input.latitude,
      context.northRotation,
    );
    if (shadowH < h) h = shadowH;
  }

  return Math.max(0, h);
}

/**
 * Build a height field grid over the buildable footprint and compute
 * the maximum allowed height at each sample point.
 */
function buildHeightField(
  buildablePolygon: Point2D[],
  context: EnvelopeRestrictionContext,
  includeShadow: boolean = true,
): HeightField {
  // Bounding box of buildable polygon
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of buildablePolygon) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / GRID_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / GRID_RESOLUTION) + 1);
  const totalPoints = rows * cols;

  const heights = new Float32Array(totalPoints);
  const insideMask = new Uint8Array(totalPoints);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const point: Point2D = {
        x: minX + col * GRID_RESOLUTION,
        y: minY + row * GRID_RESOLUTION,
      };

      // Check if point is inside buildable polygon
      if (!isInsidePolygon(point, buildablePolygon)) {
        heights[idx] = 0;
        insideMask[idx] = 0;
        continue;
      }

      insideMask[idx] = 1;
      heights[idx] = evaluateEnvelopeHeightAtPoint(point, context, includeShadow);
    }
  }

  return {
    cols,
    rows,
    resolution: GRID_RESOLUTION,
    heights,
    originX: minX,
    originY: minY,
    insideMask,
  };
}

// ---------------------------------------------------------------------------
// Mesh generation from height field
// ---------------------------------------------------------------------------

interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

/**
 * Build an individual setback envelope for a specific restriction type.
 * Returns the height field evaluated with only that restriction,
 * clamped to the combined envelope height to avoid showing
 * geometry above the actual envelope.
 */
function buildSetbackHeightField(
  combinedHeights: HeightField,
  evaluator: (point: Point2D) => number,
): HeightField {
  const { cols, rows, originX, originY, insideMask, resolution } = combinedHeights;
  const heights = new Float32Array(rows * cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) {
        heights[idx] = 0;
        continue;
      }

      const point: Point2D = {
        x: originX + col * resolution,
        y: originY + row * resolution,
      };

      const restrictionH = evaluator(point);
      // Clamp to the combined envelope so individual layers don't exceed it
      heights[idx] = Math.max(0, Math.min(restrictionH, combinedHeights.heights[idx]));
    }
  }

  return { cols, rows, resolution, heights, originX, originY, insideMask };
}

function getFieldExtent(field: HeightField): { width: number; height: number } {
  return {
    width: Math.max(0, (field.cols - 1) * field.resolution),
    height: Math.max(0, (field.rows - 1) * field.resolution),
  };
}

function resolveRenderResolution(field: HeightField, targetResolution: number): number {
  if (targetResolution >= field.resolution) return field.resolution;
  const { width, height } = getFieldExtent(field);
  const rawCols = Math.max(1, Math.ceil(width / targetResolution) + 1);
  const rawRows = Math.max(1, Math.ceil(height / targetResolution) + 1);
  const rawPoints = rawCols * rawRows;
  if (rawPoints <= MAX_RENDER_GRID_POINTS) return targetResolution;

  const scale = Math.sqrt(rawPoints / MAX_RENDER_GRID_POINTS);
  const adjusted = targetResolution * scale;
  return Math.min(field.resolution, adjusted);
}

function sampleHeightBilinear(field: HeightField, x: number, y: number): number {
  const gx = (x - field.originX) / field.resolution;
  const gy = (y - field.originY) / field.resolution;

  const c0 = Math.max(0, Math.min(field.cols - 1, Math.floor(gx)));
  const r0 = Math.max(0, Math.min(field.rows - 1, Math.floor(gy)));
  const c1 = Math.min(field.cols - 1, c0 + 1);
  const r1 = Math.min(field.rows - 1, r0 + 1);
  const tx = Math.max(0, Math.min(1, gx - c0));
  const ty = Math.max(0, Math.min(1, gy - r0));

  const corners = [
    { row: r0, col: c0, weight: (1 - tx) * (1 - ty) },
    { row: r0, col: c1, weight: tx * (1 - ty) },
    { row: r1, col: c0, weight: (1 - tx) * ty },
    { row: r1, col: c1, weight: tx * ty },
  ];

  let weightedHeight = 0;
  let totalWeight = 0;
  for (const corner of corners) {
    const idx = corner.row * field.cols + corner.col;
    if (field.insideMask[idx] === 0) continue;
    weightedHeight += field.heights[idx] * corner.weight;
    totalWeight += corner.weight;
  }
  if (totalWeight > 1e-8) return weightedHeight / totalWeight;

  // Fallback near boundary when interpolation corners are outside.
  const nearCol = Math.max(0, Math.min(field.cols - 1, Math.round(gx)));
  const nearRow = Math.max(0, Math.min(field.rows - 1, Math.round(gy)));
  let nearestDistance = Infinity;
  let nearestHeight = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = nearRow + dr;
      const col = nearCol + dc;
      if (row < 0 || row >= field.rows || col < 0 || col >= field.cols) continue;
      const idx = row * field.cols + col;
      if (field.insideMask[idx] === 0) continue;
      const dRow = row - gy;
      const dCol = col - gx;
      const dist = dRow * dRow + dCol * dCol;
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestHeight = field.heights[idx];
      }
    }
  }
  return nearestHeight;
}

type RenderHeightCap = (point: Point2D, sampledHeight: number) => number;

function buildRenderHeightField(
  field: HeightField,
  buildablePolygon: Point2D[],
  targetResolution: number,
  capHeight?: RenderHeightCap,
): HeightField {
  const renderResolution = resolveRenderResolution(field, targetResolution);
  if (renderResolution >= field.resolution - 1e-8) return field;

  const { width, height } = getFieldExtent(field);
  const cols = Math.max(1, Math.ceil(width / renderResolution) + 1);
  const rows = Math.max(1, Math.ceil(height / renderResolution) + 1);
  const heights = new Float32Array(rows * cols);
  const insideMask = new Uint8Array(rows * cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const point: Point2D = {
        x: field.originX + col * renderResolution,
        y: field.originY + row * renderResolution,
      };
      if (!isInsidePolygonOrBoundary(point, buildablePolygon)) continue;

      insideMask[idx] = 1;
      const sampledHeight = sampleHeightBilinear(field, point.x, point.y);
      const cappedHeight = capHeight
        ? Math.min(sampledHeight, capHeight(point, sampledHeight))
        : sampledHeight;
      heights[idx] = Math.max(0, cappedHeight);
    }
  }

  return {
    cols,
    rows,
    resolution: renderResolution,
    heights,
    originX: field.originX,
    originY: field.originY,
    insideMask,
  };
}

/**
 * Convert a height field into a triangle mesh.
 * For each grid cell with at least one inside vertex, create:
 *  - 2 triangles for the top surface
 *  - Ground plane vertices at z=0 (for side walls where height drops to 0)
 */
function heightFieldToMesh(field: HeightField): MeshData {
  const { cols, rows, heights, originX, originY, insideMask, resolution } = field;

  // Pre-allocate vertex and index arrays (upper bounds)
  // Each vertex: x, y, z (3 floats)
  const vertexList: number[] = [];
  const indexList: number[] = [];

  // Map from grid index to vertex index for the top surface
  const vertexMap = new Int32Array(rows * cols).fill(-1);
  let vertexCount = 0;

  // Create top surface vertices for all inside points
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) continue;

      vertexMap[idx] = vertexCount;
      // Three.js coords: X=east, Y=up(height), Z=north
      vertexList.push(
        originX + col * resolution,       // X (east)
        heights[idx],                      // Y (up = height)
        originY + row * resolution,       // Z (north)
      );
      vertexCount++;
    }
  }

  // Create ground plane vertices (z=0) for all inside points
  const groundVertexOffset = vertexCount;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) continue;

      // Three.js coords: ground plane at Y=0
      vertexList.push(
        originX + col * resolution,       // X (east)
        0,                                 // Y (ground level)
        originY + row * resolution,       // Z (north)
      );
      vertexCount++;
    }
  }

  // Create top surface triangles
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const i00 = row * cols + col;
      const i10 = row * cols + (col + 1);
      const i01 = (row + 1) * cols + col;
      const i11 = (row + 1) * cols + (col + 1);

      // All four corners must be inside
      if (
        insideMask[i00] === 0 ||
        insideMask[i10] === 0 ||
        insideMask[i01] === 0 ||
        insideMask[i11] === 0
      ) {
        continue;
      }

      const v00 = vertexMap[i00];
      const v10 = vertexMap[i10];
      const v01 = vertexMap[i01];
      const v11 = vertexMap[i11];

      // Triangle 1: CCW from above → normal points up (+Y)
      indexList.push(v00, v01, v10);
      // Triangle 2: CCW from above → normal points up (+Y)
      indexList.push(v10, v01, v11);
    }
  }

  // Create side wall triangles along the boundary
  // Detect boundary edges: inside cells adjacent to outside cells
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const idx = row * cols + col;
      const idxRight = row * cols + (col + 1);

      // Right edge: if current is inside and right is outside (or vice versa)
      if (insideMask[idx] !== insideMask[idxRight]) {
        const insideIdx = insideMask[idx] ? idx : idxRight;
        const topV = vertexMap[insideIdx];
        if (topV >= 0) {
          // Simple side: connect top to ground (degenerate, but sufficient for visualization)
          // A proper side wall would need the adjacent vertex too - handled below
        }
      }

      // We will use a simpler approach: create side walls for boundary edges of the top surface
    }
  }

  // Create ground plane triangles (same topology as top surface, at z=0)
  // Reuse the ground vertices which are at offset groundVertexOffset
  // Ground vertex for top vertex v is at groundVertexOffset + v (same relative index)
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const i00 = row * cols + col;
      const i10 = row * cols + (col + 1);
      const i01 = (row + 1) * cols + col;
      const i11 = (row + 1) * cols + (col + 1);

      if (
        insideMask[i00] === 0 ||
        insideMask[i10] === 0 ||
        insideMask[i01] === 0 ||
        insideMask[i11] === 0
      ) {
        continue;
      }

      const v00 = groundVertexOffset + vertexMap[i00];
      const v10 = groundVertexOffset + vertexMap[i10];
      const v01 = groundVertexOffset + vertexMap[i01];
      const v11 = groundVertexOffset + vertexMap[i11];

      // Winding reversed for bottom face (facing down)
      indexList.push(v00, v01, v10);
      indexList.push(v10, v01, v11);
    }
  }

  // Side walls: For each boundary edge of the top surface grid,
  // create a quad (2 triangles) connecting top and ground vertices.
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) continue;

      const topV = vertexMap[idx];
      const groundV = groundVertexOffset + topV;

      // Check each of 4 neighbors; if neighbor is outside, create wall edge
      const neighbors = [
        { dr: 0, dc: -1 }, // left
        { dr: 0, dc: 1 },  // right
        { dr: -1, dc: 0 }, // down
        { dr: 1, dc: 0 },  // up
      ];

      for (const { dr, dc } of neighbors) {
        const nr = row + dr;
        const nc = col + dc;
        const outOfBounds = nr < 0 || nr >= rows || nc < 0 || nc >= cols;
        if (!outOfBounds) {
          const nIdx = nr * cols + nc;
          if (insideMask[nIdx] !== 0) continue; // not a boundary
        }

        // This is a boundary edge. Find the two vertices that form this edge.
        // Prefer +direction pairing; if unavailable (grid edge), fallback to -direction.
        let adjRow: number, adjCol: number;
        if (dc !== 0) {
          // Vertical edge: pair with (row+1, col) or fallback (row-1, col)
          const candRows = [row + 1, row - 1];
          let chosen: number | null = null;
          for (const cr of candRows) {
            if (cr < 0 || cr >= rows) continue;
            const cIdx = cr * cols + col;
            if (insideMask[cIdx] === 0) continue;
            chosen = cr;
            break;
          }
          if (chosen === null) continue;
          adjRow = chosen;
          adjCol = col;
        } else {
          // Horizontal edge: pair with (row, col+1) or fallback (row, col-1)
          const candCols = [col + 1, col - 1];
          let chosen: number | null = null;
          for (const cc of candCols) {
            if (cc < 0 || cc >= cols) continue;
            const cIdx = row * cols + cc;
            if (insideMask[cIdx] === 0) continue;
            chosen = cc;
            break;
          }
          if (chosen === null) continue;
          adjRow = row;
          adjCol = chosen;
        }

        const adjIdx = adjRow * cols + adjCol;
        // Avoid duplicate quads for the same boundary segment.
        if (adjIdx <= idx) continue;

        const adjTopV = vertexMap[adjIdx];
        const adjGroundV = groundVertexOffset + adjTopV;

        // Enforce outward-facing winding to avoid mixed front/back shading.
        const p0x = originX + col * resolution;
        const p0y = heights[idx];
        const p0z = originY + row * resolution;
        const p1x = originX + adjCol * resolution;
        const p1y = heights[adjIdx];
        const p1z = originY + adjRow * resolution;
        const p2x = p1x;
        const p2y = 0;
        const p2z = p1z;

        const ux = p1x - p0x;
        const uy = p1y - p0y;
        const uz = p1z - p0z;
        const vx = p2x - p0x;
        const vy = p2y - p0y;
        const vz = p2z - p0z;
        const nx = uy * vz - uz * vy;
        const nz = ux * vy - uy * vx;
        const outwardX = dc;
        const outwardZ = dr;
        const outwardDot = nx * outwardX + nz * outwardZ;

        if (outwardDot < 0) {
          indexList.push(topV, adjGroundV, adjTopV);
          indexList.push(topV, groundV, adjGroundV);
        } else {
          indexList.push(topV, adjTopV, adjGroundV);
          indexList.push(topV, adjGroundV, groundV);
        }
      }
    }
  }

  return {
    vertices: new Float32Array(vertexList),
    indices: new Uint32Array(indexList),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate the building volume envelope for the given site and zoning.
 *
 * This is the CORE integration function that:
 * 1. Gets regulation params from zoning
 * 2. Applies wall setback to get buildable footprint
 * 3. Creates a grid of sample points across the site
 * 4. At each point, calculates max allowed height from ALL setback rules
 * 5. Takes the minimum (most restrictive)
 * 6. Converts height field to 3D mesh (vertices + indices)
 */
export function generateEnvelope(input: VolumeInput): VolumeResult {
  // Validate input
  const validationErrors = validateVolumeInput(input);
  if (validationErrors.length > 0) {
    const messages = validationErrors.map(e => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`入力データが不正です: ${messages}`);
  }

  const { site, zoning, roads } = input;

  // 1. Calculate coverage and floor area limits
  const maxCoverageArea = calculateMaxCoverage(site, zoning);
  const maxFloorArea = calculateMaxFloorArea(site, zoning, roads);

  // 2. Apply wall setback + confirmed road-front setbacks to get buildable footprint
  const edgeSetbacks = buildSiteEdgeSetbacks(
    site.vertices,
    roads,
    zoning.wallSetback,
    zoning.districtPlan?.wallSetback,
  );
  const buildablePolygon = applyEdgeSetbacks(site.vertices, edgeSetbacks);
  const hasVisibleBuildableInset = edgeSetbacks.some((setback) => setback > 1e-6);
  const shadowBoundary =
    zoning.shadowRegulation !== null ? buildShadowBoundary(site.vertices, roads) : null;

  // 3. Classify edges
  const siteEdges = getSiteEdges(site.vertices);
  const nonRoadEdges: SiteEdge[] = [];
  for (const edge of siteEdges) {
    if (!isRoadEdge(edge, roads)) {
      nonRoadEdges.push(edge);
    }
  }
  const northEdges = getNorthEdges(nonRoadEdges, site.vertices, roads);

  // Separate adjacent-only edges (exclude north edges to avoid double-application)
  const adjacentOnlyEdges = nonRoadEdges.filter(
    (edge) => !northEdges.some(
      (ne) => ne.start === edge.start && ne.end === edge.end
    )
  );

  // Compute north rotation for bearing-based calculations
  const northRotation = computeNorthRotation(roads, site.vertices) ?? 0;

  const roadParams = getRoadSetbackParams(zoning.district);
  const adjParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);
  const absLimit = getEffectiveAbsoluteHeightLimit(input);
  const restrictionContext: EnvelopeRestrictionContext = {
    input,
    roads,
    adjacentEdges: adjacentOnlyEdges,
    northEdges,
    shadowBoundary,
    northRotation,
    roadParams,
    adjParams,
    northParams,
    absLimit,
  };

  // 4. Build combined height field (minimum of all restrictions)
  const combinedField = buildHeightField(
    buildablePolygon,
    restrictionContext,
    true,
  );

  // Optional: a non-shadow envelope field for building pattern caps
  let nonShadowField: HeightField | null = null;
  if (zoning.shadowRegulation !== null) {
    nonShadowField = buildHeightField(
      buildablePolygon,
      restrictionContext,
      false,
    );
  }

  // 5. Determine max height and max floors from the height field
  let maxHeight = 0;
  for (let i = 0; i < combinedField.heights.length; i++) {
    if (combinedField.insideMask[i] === 1 && combinedField.heights[i] > maxHeight) {
      maxHeight = combinedField.heights[i];
    }
  }
  // Apply absolute height limit cap
  if (maxHeight > absLimit) maxHeight = absLimit;

  // Calculate maxFloors from user-provided floor heights or default
  let maxFloors: number;
  if (input.floorHeights && input.floorHeights.length > 0) {
    maxFloors = 0;
    let accumulated = 0;
    for (const fh of input.floorHeights) {
      accumulated += fh;
      if (accumulated <= maxHeight + 0.01) { // small epsilon for floating point
        maxFloors++;
      } else {
        break;
      }
    }
  } else {
    maxFloors = Math.floor(maxHeight / FLOOR_HEIGHT);
  }

  // 6. Convert combined height field to mesh (render with finer sampling for smoother surfaces)
  const combinedRenderField = buildRenderHeightField(
    combinedField,
    buildablePolygon,
    RENDER_MESH_RESOLUTION,
    (point, sampledHeight) => Math.min(
      sampledHeight,
      evaluateEnvelopeHeightAtPoint(point, restrictionContext, false),
    ),
  );
  const combinedMesh = heightFieldToMesh(combinedRenderField);

  // 7. Build individual setback envelope meshes for layer toggling
  const clampToCombinedEnvelope = (point: Point2D, sampledHeight: number): number =>
    Math.min(
      sampledHeight,
      sampleHeightBilinear(combinedField, point.x, point.y),
      evaluateEnvelopeHeightAtPoint(point, restrictionContext, false),
    );

  // Road setback envelope
  let roadEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (roads.length > 0) {
    const roadRestriction = (point: Point2D) =>
      evaluateRoadRestrictionHeight(
        point,
        roads,
        roadParams,
        getEffectiveWallSetback(input.zoning),
      );
    const roadField = buildSetbackHeightField(
      combinedField,
      roadRestriction,
    );
    const roadRenderField = buildRenderHeightField(
      roadField,
      buildablePolygon,
      RENDER_MESH_RESOLUTION,
      (point, sampledHeight) => Math.min(
        roadRestriction(point),
        clampToCombinedEnvelope(point, sampledHeight),
      ),
    );
    roadEnvelope = heightFieldToMesh(roadRenderField);
  }

  // Adjacent setback envelope
  let adjacentEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (adjacentOnlyEdges.length > 0) {
    const adjacentRestriction = (point: Point2D) =>
      evaluateAdjacentRestrictionHeight(point, adjacentOnlyEdges, adjParams);
    const adjField = buildSetbackHeightField(
      combinedField,
      adjacentRestriction,
    );
    const adjacentRenderField = buildRenderHeightField(
      adjField,
      buildablePolygon,
      RENDER_MESH_RESOLUTION,
      (point, sampledHeight) => Math.min(
        adjacentRestriction(point),
        clampToCombinedEnvelope(point, sampledHeight),
      ),
    );
    adjacentEnvelope = heightFieldToMesh(adjacentRenderField);
  }

  // North setback envelope
  let northEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (northParams !== null && northEdges.length > 0) {
    const northRestriction = (point: Point2D) =>
      evaluateNorthRestrictionHeight(point, northEdges, northParams);
    const northField = buildSetbackHeightField(
      combinedField,
      northRestriction,
    );
    const northRenderField = buildRenderHeightField(
      northField,
      buildablePolygon,
      RENDER_MESH_RESOLUTION,
      (point, sampledHeight) => Math.min(
        northRestriction(point),
        clampToCombinedEnvelope(point, sampledHeight),
      ),
    );
    northEnvelope = heightFieldToMesh(northRenderField);
  }

  // Absolute height envelope (flat plane at the limit)
  let absoluteHeightEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (zoning.absoluteHeightLimit !== null) {
    const absField = buildSetbackHeightField(
      combinedField,
      () => zoning.absoluteHeightLimit!,
    );
    const absoluteRenderField = buildRenderHeightField(
      absField,
      buildablePolygon,
      RENDER_MESH_RESOLUTION,
      (point, sampledHeight) => Math.min(
        zoning.absoluteHeightLimit!,
        clampToCombinedEnvelope(point, sampledHeight),
      ),
    );
    absoluteHeightEnvelope = heightFieldToMesh(absoluteRenderField);
  }

  // Shadow regulation envelope
  let shadowEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (zoning.shadowRegulation !== null) {
    const shadowField = buildSetbackHeightField(
      combinedField,
      (point) => calculateShadowConstrainedHeight(
        point,
        shadowBoundary ?? site.vertices,
        zoning.shadowRegulation!,
        input.latitude,
        northRotation,
      ),
    );
    const shadowRenderField = buildRenderHeightField(
      shadowField,
      buildablePolygon,
      RENDER_MESH_RESOLUTION,
      clampToCombinedEnvelope,
    );
    shadowEnvelope = heightFieldToMesh(shadowRenderField);
  }

  // Shadow projection analysis (ground plane visualization)
  let shadowProjection: ShadowProjectionResult | null = null;
  if (zoning.shadowRegulation !== null) {
    const heightFieldData: HeightFieldData = {
      cols: combinedField.cols,
      rows: combinedField.rows,
      originX: combinedField.originX,
      originY: combinedField.originY,
      resolution: combinedField.resolution,
      heights: combinedField.heights,
      insideMask: combinedField.insideMask,
    };
    shadowProjection = generateShadowProjection(
      heightFieldData,
      shadowBoundary ?? site.vertices,
      zoning.shadowRegulation,
      input.latitude,
      northRotation,
    );
  }

  // Reverse shadow analysis (逆日影ライン)
  let reverseShadow: ReverseShadowResult | null = null;
  if (zoning.shadowRegulation !== null) {
    reverseShadow = generateReverseShadow(
      buildablePolygon,
      shadowBoundary ?? site.vertices,
      zoning.shadowRegulation,
      input.latitude,
      northRotation,
    );
  }

  // Building pattern comparison (建物パターン別日影シミュレーション)
  let buildingPatterns: BuildingPatternResult | null = null;
  if (zoning.shadowRegulation !== null) {
    const sourceField = nonShadowField ?? combinedField;
    const envelopeHF: HeightFieldData = {
      cols: sourceField.cols,
      rows: sourceField.rows,
      originX: sourceField.originX,
      originY: sourceField.originY,
      resolution: sourceField.resolution,
      heights: sourceField.heights,
      insideMask: sourceField.insideMask,
    };
    buildingPatterns = generateBuildingPatterns(
      input,
      buildablePolygon,
      shadowBoundary ?? site.vertices,
      northRotation,
      envelopeHF,
    );
  }

  return {
    maxFloorArea,
    maxCoverageArea,
    maxHeight: Math.round(maxHeight * 100) / 100,
    maxFloors,
    envelopeVertices: combinedMesh.vertices,
    envelopeIndices: combinedMesh.indices,
    setbackEnvelopes: {
      road: roadEnvelope,
      adjacent: adjacentEnvelope,
      north: northEnvelope,
      absoluteHeight: absoluteHeightEnvelope,
      shadow: shadowEnvelope,
    },
    shadowProjection,
    reverseShadow,
    buildingPatterns,
    buildablePolygon: hasVisibleBuildableInset ? buildablePolygon : null,
    shadowBoundary,
    heightFieldData: zoning.shadowRegulation !== null ? {
      cols: combinedField.cols,
      rows: combinedField.rows,
      originX: combinedField.originX,
      originY: combinedField.originY,
      resolution: combinedField.resolution,
      heights: combinedField.heights,
      insideMask: combinedField.insideMask,
    } : null,
  };
}
