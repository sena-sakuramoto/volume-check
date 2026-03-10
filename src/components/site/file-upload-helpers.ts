interface ZoningLike {
  district?: string | null;
  coverageRatio?: number | null;
  floorAreaRatio?: number | null;
  fireDistrict?: string | null;
}

interface SupplementSummaryInput {
  usedAddress: string;
  geocoded: boolean;
  zoningSupplemented: boolean;
}

export function normalizeDetectedAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\u3000/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
}

export function mergeZoningWithSupplement(
  primary: ZoningLike | null | undefined,
  supplement: ZoningLike | null | undefined,
): ZoningLike | undefined {
  if (!primary && !supplement) return undefined;

  return {
    district: primary?.district ?? supplement?.district ?? null,
    coverageRatio: primary?.coverageRatio ?? supplement?.coverageRatio ?? null,
    floorAreaRatio: primary?.floorAreaRatio ?? supplement?.floorAreaRatio ?? null,
    fireDistrict: primary?.fireDistrict ?? supplement?.fireDistrict ?? null,
  };
}

export function summarizeSupplementResult(input: SupplementSummaryInput): string {
  const tags: string[] = [];
  if (input.geocoded) tags.push('住所補完');
  if (input.zoningSupplemented) tags.push('用途地域補完');
  if (tags.length === 0) return '';
  return `${tags.join(' / ')}: ${input.usedAddress}`;
}

