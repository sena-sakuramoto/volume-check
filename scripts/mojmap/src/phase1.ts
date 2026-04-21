import phase1Json from '../phase1_municipalities.json' with { type: 'json' };

interface Phase1Group {
  name: string;
  codes: string[];
}

interface Phase1File {
  phase: number;
  schemaVersion: number;
  groups: Phase1Group[];
}

const phase1 = phase1Json as unknown as Phase1File;

/**
 * Flat set of Phase 1 municipality codes. Build once at import time because
 * the JSON file is embedded.
 */
export const PHASE1_CODES: ReadonlySet<string> = new Set(
  phase1.groups.flatMap((g) => g.codes),
);

export function phase1Size(): number {
  return PHASE1_CODES.size;
}

export function isPhase1(municipalityCode: string | null | undefined): boolean {
  return !!municipalityCode && PHASE1_CODES.has(municipalityCode);
}

/** Expose groups for diagnostics / docs. */
export function phase1Groups(): Readonly<Phase1Group[]> {
  return phase1.groups;
}
