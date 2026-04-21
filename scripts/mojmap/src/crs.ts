import crsMapJson from '../crs_map.json' with { type: 'json' };

/**
 * Resolve the JGD2011 平面直角座標系 zone number (1..19) for a given JIS X 0402
 * 5-digit 市区町村 code. Tries a per-municipality override first, then falls
 * back to prefecture-level default. Throws when the code is unknown — the
 * parser must not guess because a wrong zone would place the site 100km off.
 */
interface CrsMap {
  byPrefecture: Record<string, number>;
  byMunicipality: Record<string, number>;
}

const crsMap = crsMapJson as unknown as CrsMap;

export function resolveZone(municipalityCode: string): number {
  if (!/^\d{5}$/.test(municipalityCode)) {
    throw new Error(`invalid municipality code: ${municipalityCode}`);
  }
  const override = crsMap.byMunicipality[municipalityCode];
  if (override) return override;
  const prefecture = municipalityCode.slice(0, 2);
  const zone = crsMap.byPrefecture[prefecture];
  if (!zone) {
    throw new Error(
      `no CRS zone registered for prefecture ${prefecture} (municipality ${municipalityCode}). Update scripts/mojmap/crs_map.json.`,
    );
  }
  return zone;
}

/** EPSG code for JGD2011 平面直角座標系 zone N. Zone 1 = 6669, ..., zone 19 = 6687. */
export function epsgForZone(zone: number): number {
  if (!Number.isInteger(zone) || zone < 1 || zone > 19) {
    throw new Error(`zone out of range: ${zone}`);
  }
  return 6668 + zone;
}

export function epsgForMunicipality(municipalityCode: string): number {
  return epsgForZone(resolveZone(municipalityCode));
}
