import { z } from 'zod';
import { polygonArea } from './geometry';
import type { Point2D, VolumeInput } from './types';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

export const Point2DSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const RoadSchema = z.object({
  edgeStart: Point2DSchema,
  edgeEnd: Point2DSchema,
  width: z.number().positive('道路幅員は正の値が必要です'),
  centerOffset: z.number().finite(),
  bearing: z.number().min(0).max(360),
});

const ZoningDistrictValues = [
  '第一種低層住居専用地域',
  '第二種低層住居専用地域',
  '第一種中高層住居専用地域',
  '第二種中高層住居専用地域',
  '第一種住居地域',
  '第二種住居地域',
  '準住居地域',
  '田園住居地域',
  '近隣商業地域',
  '商業地域',
  '準工業地域',
  '工業地域',
  '工業専用地域',
] as const;

export const ZoningDataSchema = z.object({
  district: z.enum(ZoningDistrictValues),
  fireDistrict: z.enum(['防火地域', '準防火地域', '指定なし']),
  heightDistrict: z.object({
    type: z.enum(['第一種', '第二種', '第三種', '指定なし']),
    maxHeightAtBoundary: z.number().positive().optional(),
    slopeRatio: z.number().positive().optional(),
    absoluteMax: z.number().positive().optional(),
  }),
  coverageRatio: z.number().min(0).max(1),
  floorAreaRatio: z.number().positive(),
  absoluteHeightLimit: z.number().positive().nullable(),
  wallSetback: z.number().min(0).nullable(),
  shadowRegulation: z
    .object({
      measurementHeight: z.number().positive(),
      maxHoursAt5m: z.number().min(0),
      maxHoursAt10m: z.number().min(0),
    })
    .nullable(),
  isCornerLot: z.boolean(),
});

export const SiteBoundarySchema = z.object({
  vertices: z.array(Point2DSchema).min(3, '敷地頂点は3つ以上必要です'),
  area: z.number().positive('敷地面積は正の値が必要です'),
});

export const VolumeInputSchema = z.object({
  site: SiteBoundarySchema,
  zoning: ZoningDataSchema,
  roads: z.array(RoadSchema),
  latitude: z.number().min(-90).max(90),
  floorHeights: z.array(z.number().positive()).optional(),
});

// ---------------------------------------------------------------------------
// Geometric validation helpers
// ---------------------------------------------------------------------------

/**
 * Check if two line segments (a1-a2) and (b1-b2) intersect properly
 * (crossing, not just touching at endpoints).
 */
function segmentsCross(a1: Point2D, a2: Point2D, b1: Point2D, b2: Point2D): boolean {
  const d1 = cross(a1, a2, b1);
  const d2 = cross(a1, a2, b2);
  const d3 = cross(b1, b2, a1);
  const d4 = cross(b1, b2, a2);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

/** Cross product of vectors (b-a) and (c-a) */
function cross(a: Point2D, b: Point2D, c: Point2D): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Check if a polygon is simple (no self-intersections).
 * O(n²) segment-vs-segment test, skipping adjacent edges.
 */
export function isSimplePolygon(vertices: Point2D[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges (they share a vertex)
      if (i === 0 && j === n - 1) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segmentsCross(a1, a2, b1, b2)) {
        return false;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Integrated validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate VolumeInput with both schema and geometric checks.
 * Returns an array of errors (empty = valid).
 */
export function validateVolumeInput(input: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Schema validation
  const result = VolumeInputSchema.safeParse(input);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push({
        field: issue.path.join('.'),
        message: issue.message,
      });
    }
    return errors; // Can't do geometric checks on invalid data
  }

  const data = result.data as VolumeInput;

  // 2. Polygon self-intersection check
  if (!isSimplePolygon(data.site.vertices)) {
    errors.push({
      field: 'site.vertices',
      message: '敷地ポリゴンが自己交差しています',
    });
  }

  // 3. Area consistency check (declared vs computed, >10% divergence = error)
  const computedArea = polygonArea(data.site.vertices);
  const declaredArea = data.site.area;
  if (declaredArea > 0 && computedArea > 0) {
    const ratio = Math.abs(computedArea - declaredArea) / declaredArea;
    if (ratio > 0.1) {
      errors.push({
        field: 'site.area',
        message: `宣言面積(${declaredArea}㎡)と計算面積(${computedArea.toFixed(1)}㎡)の乖離が10%を超えています`,
      });
    }
  }

  return errors;
}
