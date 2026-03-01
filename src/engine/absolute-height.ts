/**
 * Get the absolute height limit (絶対高さ制限) for the site.
 * Returns Infinity if no limit is set (null).
 *
 * Absolute height limits apply to:
 * - 第一種低層住居専用地域: 10m or 12m
 * - 第二種低層住居専用地域: 10m or 12m
 * - 田園住居地域: 10m or 12m
 */
export function getAbsoluteHeightLimit(limit: number | null): number {
  return limit ?? Infinity;
}
