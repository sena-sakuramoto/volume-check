import type {
  Point2D,
  Road,
  VolumeInput,
  VolumeResult,
} from './types';
import { distanceToSegment, isInsidePolygon, polygonArea, edgeOutwardAngle } from './geometry';
import { calculateMaxCoverage } from './coverage';
import { calculateMaxFloorArea } from './floor-area';
import { getAbsoluteHeightLimit } from './absolute-height';
import { calculateRoadSetbackHeight } from './setback-road';
import { calculateAdjacentSetbackHeight } from './setback-adjacent';
import { calculateNorthSetbackHeight } from './setback-north';
import { calculateHeightDistrictLimit } from './height-district';
import { applyWallSetback } from './wall-setback';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
} from './zoning';
import { validateVolumeInput } from './validation';
import { calculateShadowConstrainedHeight } from './shadow';
import { generateShadowProjection } from './shadow-projection';
import { generateReverseShadow } from './reverse-shadow';
import type { HeightFieldData, ShadowProjectionResult, ReverseShadowResult } from './types';

/** Grid resolution in meters for sampling height field */
const GRID_RESOLUTION = 0.5;

/** Assumed floor height in meters for maxFloors estimation */
const FLOOR_HEIGHT = 3.0;

/** Threshold for classifying an edge as roughly horizontal (for north detection) */
const HORIZONTAL_THRESHOLD = 0.3; // radians (~17 degrees)

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
export function computeNorthRotation(roads: Road[], _siteVertices: Point2D[]): number | null {
  const deltas: number[] = [];

  for (const road of roads) {
    const bearingRad = (road.bearing * Math.PI) / 180;
    const dx = road.edgeEnd.x - road.edgeStart.x;
    const dy = road.edgeEnd.y - road.edgeStart.y;
    const coordAngle = Math.atan2(-dx, dy); // outward normal math angle
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
export function edgeCompassBearing(edge: SiteEdge, delta: number): number {
  const coordAngle = edgeOutwardAngle(edge.start, edge.end);
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

  // Try compass-based detection if roads have bearing info
  if (roads && roads.length > 0) {
    const northRotation = computeNorthRotation(roads, vertices);
    if (northRotation !== null) {
      const northEdges: SiteEdge[] = [];
      for (const edge of nonRoadEdges) {
        const bearing = edgeCompassBearing(edge, northRotation);
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
  /** Height values, row-major [row * cols + col] */
  heights: Float32Array;
  /** Grid origin (min x, min y of bounding box) */
  originX: number;
  originY: number;
  /** Boolean mask: true if point is inside the buildable polygon */
  insideMask: Uint8Array;
}

/**
 * Build a height field grid over the buildable footprint and compute
 * the maximum allowed height at each sample point.
 */
function buildHeightField(
  buildablePolygon: Point2D[],
  input: VolumeInput,
  roads: Road[],
  adjacentEdges: SiteEdge[],
  northEdges: SiteEdge[],
  northRotation: number,
): HeightField {
  const { zoning } = input;

  // Regulation params
  const roadParams = getRoadSetbackParams(zoning.district);
  const adjParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);
  const absLimit = getAbsoluteHeightLimit(zoning.absoluteHeightLimit);

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

      // Start with absolute height limit
      let h = absLimit;

      // Road setback (道路斜線制限) - check all roads
      for (const road of roads) {
        const roadH = calculateRoadSetbackHeight(
          point,
          road,
          roadParams.slopeRatio,
          roadParams.applicationDistance,
        );
        if (roadH < h) h = roadH;
      }

      // Adjacent setback (隣地斜線制限) - check adjacent edges only (not north)
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

      // North setback (北側斜線制限) - only if applicable
      if (northParams !== null) {
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
      }

      // Height district (高度地区) - applies to all non-road edges
      if (input.zoning.heightDistrict.type !== '指定なし') {
        for (const edge of adjacentEdges) {
          const hdH = calculateHeightDistrictLimit(
            point,
            edge.start,
            edge.end,
            input.zoning.heightDistrict,
          );
          if (hdH < h) h = hdH;
        }
        for (const edge of northEdges) {
          const hdH = calculateHeightDistrictLimit(
            point,
            edge.start,
            edge.end,
            input.zoning.heightDistrict,
          );
          if (hdH < h) h = hdH;
        }
      }

      // Shadow regulation (日影規制) - only if applicable
      if (input.zoning.shadowRegulation !== null) {
        const shadowH = calculateShadowConstrainedHeight(
          point,
          input.site.vertices,
          input.zoning.shadowRegulation,
          input.latitude,
          northRotation,
        );
        if (shadowH < h) h = shadowH;
      }

      // Ensure non-negative
      heights[idx] = Math.max(0, h);
    }
  }

  return { cols, rows, heights, originX: minX, originY: minY, insideMask };
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
  buildablePolygon: Point2D[],
  combinedHeights: HeightField,
  evaluator: (point: Point2D) => number,
): HeightField {
  const { cols, rows, originX, originY, insideMask } = combinedHeights;
  const heights = new Float32Array(rows * cols);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (insideMask[idx] === 0) {
        heights[idx] = 0;
        continue;
      }

      const point: Point2D = {
        x: originX + col * GRID_RESOLUTION,
        y: originY + row * GRID_RESOLUTION,
      };

      const restrictionH = evaluator(point);
      // Clamp to the combined envelope so individual layers don't exceed it
      heights[idx] = Math.max(0, Math.min(restrictionH, combinedHeights.heights[idx]));
    }
  }

  return { cols, rows, heights, originX, originY, insideMask };
}

/**
 * Convert a height field into a triangle mesh.
 * For each grid cell with at least one inside vertex, create:
 *  - 2 triangles for the top surface
 *  - Ground plane vertices at z=0 (for side walls where height drops to 0)
 */
function heightFieldToMesh(field: HeightField): MeshData {
  const { cols, rows, heights, originX, originY, insideMask } = field;

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
        originX + col * GRID_RESOLUTION,  // X (east)
        heights[idx],                      // Y (up = height)
        originY + row * GRID_RESOLUTION,   // Z (north)
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
        originX + col * GRID_RESOLUTION,  // X (east)
        0,                                 // Y (ground level)
        originY + row * GRID_RESOLUTION,   // Z (north)
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

      // Triangle 1: (00, 10, 01)
      indexList.push(v00, v10, v01);
      // Triangle 2: (10, 11, 01)
      indexList.push(v10, v11, v01);
    }
  }

  // Create side wall triangles along the boundary
  // Detect boundary edges: inside cells adjacent to outside cells
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const idx = row * cols + col;
      const idxRight = row * cols + (col + 1);
      const idxUp = (row + 1) * cols + col;

      // Right edge: if current is inside and right is outside (or vice versa)
      if (insideMask[idx] !== insideMask[idxRight]) {
        const insideIdx = insideMask[idx] ? idx : idxRight;
        const topV = vertexMap[insideIdx];
        if (topV >= 0) {
          // Find the corresponding ground vertex
          // Ground vertices are offset by groundVertexOffset, in same order as top vertices
          const groundV = groundVertexOffset + topV;
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
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
          // Out of grid bounds = boundary
          // Need an adjacent inside point along the boundary to form a wall quad
          continue;
        }
        const nIdx = nr * cols + nc;
        if (insideMask[nIdx] !== 0) continue; // not a boundary

        // This is a boundary edge. Find the two vertices that form this edge.
        // For a proper wall, we need the next vertex along the boundary direction.
        // We handle this by looking at the perpendicular neighbors.
        // For left/right walls (dc != 0): the edge runs vertically, check row+1
        // For up/down walls (dr != 0): the edge runs horizontally, check col+1
        let adjRow: number, adjCol: number;
        if (dc !== 0) {
          // Vertical edge: pair with (row+1, col)
          adjRow = row + 1;
          adjCol = col;
        } else {
          // Horizontal edge: pair with (row, col+1)
          adjRow = row;
          adjCol = col + 1;
        }

        if (adjRow < 0 || adjRow >= rows || adjCol < 0 || adjCol >= cols) continue;
        const adjIdx = adjRow * cols + adjCol;
        if (insideMask[adjIdx] === 0) continue;

        const adjTopV = vertexMap[adjIdx];
        const adjGroundV = groundVertexOffset + adjTopV;

        // Quad: (topV, adjTopV, adjGroundV, groundV) -> 2 triangles
        indexList.push(topV, adjTopV, adjGroundV);
        indexList.push(topV, adjGroundV, groundV);
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

  // 2. Apply wall setback to get buildable footprint
  const buildablePolygon = applyWallSetback(site.vertices, zoning.wallSetback);

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

  // 4. Build combined height field (minimum of all restrictions)
  const combinedField = buildHeightField(
    buildablePolygon,
    input,
    roads,
    adjacentOnlyEdges,
    northEdges,
    northRotation,
  );

  // 5. Determine max height and max floors from the height field
  let maxHeight = 0;
  for (let i = 0; i < combinedField.heights.length; i++) {
    if (combinedField.insideMask[i] === 1 && combinedField.heights[i] > maxHeight) {
      maxHeight = combinedField.heights[i];
    }
  }
  // Apply absolute height limit cap
  const absLimit = getAbsoluteHeightLimit(zoning.absoluteHeightLimit);
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

  // 6. Convert combined height field to mesh
  const combinedMesh = heightFieldToMesh(combinedField);

  // 7. Build individual setback envelope meshes for layer toggling

  // Get regulation params for individual evaluations
  const roadParams = getRoadSetbackParams(zoning.district);
  const adjParams = getAdjacentSetbackParams(zoning.district);
  const northParams = getNorthSetbackParams(zoning.district);

  // Road setback envelope
  let roadEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (roads.length > 0) {
    const roadField = buildSetbackHeightField(
      buildablePolygon,
      combinedField,
      (point) => {
        let h = Infinity;
        for (const road of roads) {
          const rh = calculateRoadSetbackHeight(
            point,
            road,
            roadParams.slopeRatio,
            roadParams.applicationDistance,
          );
          if (rh < h) h = rh;
        }
        return h;
      },
    );
    roadEnvelope = heightFieldToMesh(roadField);
  }

  // Adjacent setback envelope
  let adjacentEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (adjacentOnlyEdges.length > 0) {
    const adjField = buildSetbackHeightField(
      buildablePolygon,
      combinedField,
      (point) => {
        let h = Infinity;
        for (const edge of adjacentOnlyEdges) {
          const ah = calculateAdjacentSetbackHeight(
            point,
            edge.start,
            edge.end,
            adjParams.riseHeight,
            adjParams.slopeRatio,
          );
          if (ah < h) h = ah;
        }
        return h;
      },
    );
    adjacentEnvelope = heightFieldToMesh(adjField);
  }

  // North setback envelope
  let northEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (northParams !== null && northEdges.length > 0) {
    const northField = buildSetbackHeightField(
      buildablePolygon,
      combinedField,
      (point) => {
        let h = Infinity;
        for (const edge of northEdges) {
          const nh = calculateNorthSetbackHeight(
            point,
            edge.start,
            edge.end,
            northParams.riseHeight,
            northParams.slopeRatio,
          );
          if (nh < h) h = nh;
        }
        return h;
      },
    );
    northEnvelope = heightFieldToMesh(northField);
  }

  // Absolute height envelope (flat plane at the limit)
  let absoluteHeightEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (zoning.absoluteHeightLimit !== null) {
    const absField = buildSetbackHeightField(
      buildablePolygon,
      combinedField,
      () => zoning.absoluteHeightLimit!,
    );
    absoluteHeightEnvelope = heightFieldToMesh(absField);
  }

  // Shadow regulation envelope
  let shadowEnvelope: { vertices: Float32Array; indices: Uint32Array } | null = null;
  if (zoning.shadowRegulation !== null) {
    const shadowField = buildSetbackHeightField(
      buildablePolygon,
      combinedField,
      (point) => calculateShadowConstrainedHeight(
        point,
        site.vertices,
        zoning.shadowRegulation!,
        input.latitude,
        northRotation,
      ),
    );
    shadowEnvelope = heightFieldToMesh(shadowField);
  }

  // Shadow projection analysis (ground plane visualization)
  let shadowProjection: ShadowProjectionResult | null = null;
  if (zoning.shadowRegulation !== null) {
    const heightFieldData: HeightFieldData = {
      cols: combinedField.cols,
      rows: combinedField.rows,
      originX: combinedField.originX,
      originY: combinedField.originY,
      resolution: GRID_RESOLUTION,
      heights: combinedField.heights,
      insideMask: combinedField.insideMask,
    };
    shadowProjection = generateShadowProjection(
      heightFieldData,
      site.vertices,
      zoning.shadowRegulation,
      input.latitude,
      northRotation,
    );
  }

  // Reverse shadow analysis (逆日影ライン)
  let reverseShadow: ReverseShadowResult | null = null;
  if (zoning.shadowRegulation !== null) {
    reverseShadow = generateReverseShadow(
      site.vertices,
      buildablePolygon,
      zoning.shadowRegulation,
      input.latitude,
      northRotation,
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
    heightFieldData: zoning.shadowRegulation !== null ? {
      cols: combinedField.cols,
      rows: combinedField.rows,
      originX: combinedField.originX,
      originY: combinedField.originY,
      resolution: GRID_RESOLUTION,
      heights: combinedField.heights,
      insideMask: combinedField.insideMask,
    } : null,
  };
}
