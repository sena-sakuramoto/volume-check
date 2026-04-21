import { phase1Groups, PHASE1_CODES } from '../phase1.js';
import { resolveZone, epsgForZone } from '../crs.js';

/**
 * Sanity-check every Phase 1 municipality code can be resolved to a CRS
 * zone. Run this before the first production pipeline run to catch typos
 * in phase1_municipalities.json or gaps in crs_map.json.
 */

interface Row {
  code: string;
  group: string;
  zone: number;
  epsg: number;
}

function main() {
  const rows: Row[] = [];
  const errors: string[] = [];
  for (const group of phase1Groups()) {
    for (const code of group.codes) {
      try {
        const zone = resolveZone(code);
        rows.push({ code, group: group.name, zone, epsg: epsgForZone(zone) });
      } catch (err) {
        errors.push(`${code} (${group.name}): ${(err as Error).message}`);
      }
    }
  }
  console.log(`Phase 1 municipalities: ${PHASE1_CODES.size}`);
  const byZone = new Map<number, number>();
  for (const r of rows) byZone.set(r.zone, (byZone.get(r.zone) ?? 0) + 1);
  console.log('zone histogram:');
  for (const [zone, n] of [...byZone.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  zone ${zone} (EPSG:${epsgForZone(zone)}): ${n}`);
  }
  if (errors.length > 0) {
    console.error(`\n${errors.length} unresolved:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('\nOK — all Phase 1 codes resolve to a CRS zone.');
}

main();
