import type { Point2D, ShadowRegulation, HeightFieldData, ContourLine, ReverseShadowResult } from './types';
import { calculateShadowConstrainedHeight } from './shadow';

// ---------------------------------------------------------------------------
// Reverse shadow (逆日影) analysis
// ---------------------------------------------------------------------------

/** Grid resolution for the reverse shadow height field (meters) */
const REVERSE_SHADOW_RESOLUTION = 0.3;

/**
 * Generate the reverse shadow (逆日影) analysis.
 *
 * This computes:
 * 1. A height field showing the max buildable height constrained ONLY by
 *    shadow regulation at each point on the site.
 * 2. Contour lines (逆日影ライン) at standard height intervals showing
 *    where the shadow constraint limits the building height.
 * 3. 5m/10m measurement offset lines.
 *
 * This is the correct approach for volume checking — starting from the
 * regulation constraints and working backward to find the maximum
 * buildable envelope, rather than projecting shadows forward.
 */
export function generateReverseShadow(
  siteVertices: Point2D[],
  buildablePolygon: Point2D[],
  shadowReg: ShadowRegulation,
  latitude: number,
  northRotation: number,
): ReverseShadowResult {
  // Bounding box of buildable polygon
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of buildablePolygon) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const cols = Math.max(1, Math.ceil((maxX - minX) / REVERSE_SHADOW_RESOLUTION) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / REVERSE_SHADOW_RESOLUTION) + 1);

  const heights = new Float32Array(rows * cols);
  const insideMask = new Uint8Array(rows * cols);

  // Compute shadow-constrained height at each grid point
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const point: Point2D = {
        x: minX + col * REVERSE_SHADOW_RESOLUTION,
        y: minY + row * REVERSE_SHADOW_RESOLUTION,
      };

      // Check if inside buildable polygon (simplified ray-casting)
      if (!isInsidePoly(point, buildablePolygon)) {
        heights[idx] = 0;
        insideMask[idx] = 0;
        continue;
      }

      insideMask[idx] = 1;
      heights[idx] = calculateShadowConstrainedHeight(
        point,
        siteVertices,
        shadowReg,
        latitude,
        northRotation,
      );
    }
  }

  const shadowHeightField: HeightFieldData = {
    cols,
    rows,
    originX: minX,
    originY: minY,
    resolution: REVERSE_SHADOW_RESOLUTION,
    heights,
    insideMask,
  };

  // Extract contour lines at standard height intervals
  const contourHeights = generateContourHeights(heights, insideMask);
  const contourLines = contourHeights.map((h) =>
    extractContour(shadowHeightField, h),
  );

  // Generate 5m and 10m offset lines
  const line5m = generateOffsetLine(siteVertices, 5);
  const line10m = generateOffsetLine(siteVertices, 10);

  return { shadowHeightField, contourLines, line5m, line10m };
}

// ---------------------------------------------------------------------------
// Contour extraction (Marching Squares)
// ---------------------------------------------------------------------------

/**
 * Determine appropriate contour heights based on the range of the height field.
 * Uses standard intervals: every 3m (matching typical floor heights).
 */
function generateContourHeights(
  heights: Float32Array,
  insideMask: Uint8Array,
): number[] {
  let minH = Infinity, maxH = -Infinity;
  for (let i = 0; i < heights.length; i++) {
    if (insideMask[i] === 0) continue;
    if (heights[i] < minH) minH = heights[i];
    if (heights[i] > maxH) maxH = heights[i];
  }

  if (minH >= maxH || !isFinite(minH)) return [];

  // Use adaptive interval: 1m for small ranges, 1.5m for medium, 2m for large
  const range = maxH - minH;
  const interval = range < 15 ? 1 : range < 30 ? 1.5 : 2;
  const result: number[] = [];
  const startH = Math.ceil(minH / interval) * interval;
  for (let h = startH; h <= maxH; h += interval) {
    if (h > 0) result.push(h);
  }
  // Cap at 20 contour lines to avoid visual clutter
  if (result.length > 20) {
    const step = Math.ceil(result.length / 20);
    return result.filter((_, i) => i % step === 0);
  }
  return result;
}

/**
 * Extract a single contour line at a given height using Marching Squares.
 *
 * For each grid cell, determines which edges the contour crosses by
 * comparing corner heights to the threshold. Linearly interpolates
 * the crossing position along each edge.
 */
function extractContour(field: HeightFieldData, height: number): ContourLine {
  const { cols, rows, originX, originY, resolution, heights, insideMask } = field;
  const segments: { start: Point2D; end: Point2D }[] = [];

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      // Four corners of the cell: (col,row), (col+1,row), (col+1,row+1), (col,row+1)
      const i00 = row * cols + col;
      const i10 = row * cols + (col + 1);
      const i01 = (row + 1) * cols + col;
      const i11 = (row + 1) * cols + (col + 1);

      // Skip if any corner is outside the buildable area
      if (insideMask[i00] === 0 || insideMask[i10] === 0 ||
          insideMask[i01] === 0 || insideMask[i11] === 0) continue;

      const h00 = heights[i00];
      const h10 = heights[i10];
      const h01 = heights[i01];
      const h11 = heights[i11];

      // Marching squares case index (4-bit)
      const caseIdx =
        (h00 >= height ? 1 : 0) |
        (h10 >= height ? 2 : 0) |
        (h11 >= height ? 4 : 0) |
        (h01 >= height ? 8 : 0);

      if (caseIdx === 0 || caseIdx === 15) continue; // all below or all above

      // Cell corners in world coordinates
      const x0 = originX + col * resolution;
      const y0 = originY + row * resolution;
      const x1 = x0 + resolution;
      const y1 = y0 + resolution;

      // Interpolation helper: fraction along edge where contour crosses
      const lerp = (a: number, b: number) => {
        const denom = b - a;
        if (Math.abs(denom) < 1e-10) return 0.5;
        return (height - a) / denom;
      };

      // Edge midpoints where contour crosses
      // Bottom: (x0,y0)→(x1,y0)
      const eb = (): Point2D => {
        const t = lerp(h00, h10);
        return { x: x0 + t * resolution, y: y0 };
      };
      // Right: (x1,y0)→(x1,y1)
      const er = (): Point2D => {
        const t = lerp(h10, h11);
        return { x: x1, y: y0 + t * resolution };
      };
      // Top: (x0,y1)→(x1,y1)
      const et = (): Point2D => {
        const t = lerp(h01, h11);
        return { x: x0 + t * resolution, y: y1 };
      };
      // Left: (x0,y0)→(x0,y1)
      const el = (): Point2D => {
        const t = lerp(h00, h01);
        return { x: x0, y: y0 + t * resolution };
      };

      // Marching squares lookup: which edges to connect
      switch (caseIdx) {
        case 1:  segments.push({ start: eb(), end: el() }); break;
        case 2:  segments.push({ start: er(), end: eb() }); break;
        case 3:  segments.push({ start: er(), end: el() }); break;
        case 4:  segments.push({ start: et(), end: er() }); break;
        case 5:  // Saddle point: two segments
          segments.push({ start: eb(), end: er() });
          segments.push({ start: et(), end: el() });
          break;
        case 6:  segments.push({ start: et(), end: eb() }); break;
        case 7:  segments.push({ start: et(), end: el() }); break;
        case 8:  segments.push({ start: el(), end: et() }); break;
        case 9:  segments.push({ start: eb(), end: et() }); break;
        case 10: // Saddle point: two segments
          segments.push({ start: eb(), end: el() });
          segments.push({ start: et(), end: er() });
          break;
        case 11: segments.push({ start: er(), end: et() }); break;
        case 12: segments.push({ start: el(), end: er() }); break;
        case 13: segments.push({ start: eb(), end: er() }); break;
        case 14: segments.push({ start: el(), end: eb() }); break;
      }
    }
  }

  return { height, segments };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ray-casting point-in-polygon check */
function isInsidePoly(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Line-line intersection for offset line generation */
function lineLineIntersection(
  p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D,
): Point2D | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/** Generate outward offset polygon from site boundary */
function generateOffsetLine(vertices: Point2D[], offset: number): Point2D[] {
  const n = vertices.length;
  if (n < 3) return [];

  const offsetEdges: { start: Point2D; end: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-10) continue;
    const nx = (dy / len) * offset, ny = (-dx / len) * offset;
    offsetEdges.push({
      start: { x: a.x + nx, y: a.y + ny },
      end: { x: b.x + nx, y: b.y + ny },
    });
  }

  if (offsetEdges.length < 2) return [];

  const result: Point2D[] = [];
  for (let i = 0; i < offsetEdges.length; i++) {
    const e1 = offsetEdges[i];
    const e2 = offsetEdges[(i + 1) % offsetEdges.length];
    const pt = lineLineIntersection(e1.start, e1.end, e2.start, e2.end);
    result.push(pt ?? e1.end);
  }
  return result;
}
