import { z } from 'zod';
import { polygonArea, isSimplePolygon } from './geometry';
import type { VolumeInput } from './types';

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
  frontSetback: z.number().min(0).optional(),
  oppositeSideSetback: z.number().min(0).optional(),
  oppositeOpenSpace: z.number().min(0).optional(),
  oppositeOpenSpaceKind: z
    .enum(['none', 'alley', 'waterway', 'river', 'railway', 'park', 'plaza'])
    .optional(),
  slopeWidthOverride: z.number().positive().optional(),
  siteHeightAboveRoad: z.number().finite().optional(),
  enableTwoA35m: z.boolean().optional(),
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
    autoDetected: z.boolean().optional(),
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
  districtPlan: z
    .object({
      name: z.string().min(1),
      restrictions: z.string().optional(),
      maxHeight: z.number().positive().optional(),
      minHeight: z.number().positive().optional(),
      wallSetback: z.number().min(0).optional(),
      floorAreaRatio: z.number().min(0).max(1).optional(),
      coverageRatio: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .optional()
    .default(null),
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

export { isSimplePolygon };

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
