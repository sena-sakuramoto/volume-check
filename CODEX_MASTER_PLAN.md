# CODEX_MASTER_PLAN

Updated: 2026-03-06
Owner: Codex implementation pass

## Objective
Ship the current VolumeCheck scope as a working, verifiable build:
- address -> parcel/site/zoning restore flow works end-to-end
- road lookup and PLATEAU URF lookup are integrated and tested
- feasibility and PDF export remain working
- lint, test, build, and runtime smoke all pass locally

## Corrected Plan
1. Audit the implemented code against the real product goal instead of the older feature-by-feature notes.
2. Fix completion blockers first: broken restore flow, weak API input validation, missing tests, offline build issues, and framework deprecations.
3. Re-run the full quality gate: eslint, jest, next build, then runtime smoke with next start.
4. Leave only acceptance-level/manual confirmation as follow-up.

## Implemented
- Project restore flow now restores auxiliary UI state together with site, roads, and zoning.
- `plateau-urf-lookup` now uses shared coordinate parsing and accepts normalized numeric string input safely.
- Added API tests for `plateau-urf-lookup` and `road-lookup`.
- Added `pdf-export` test coverage.
- Removed online Google Fonts dependency so offline production build succeeds.
- Migrated deprecated `middleware` usage to `proxy.ts` for Next 16.
- Stabilized package manager metadata in `package.json`.

## Verification
- `eslint src`: PASS
- `jest --runInBand`: PASS (34 suites / 362 tests)
- `next build`: PASS
- `next start` smoke on `/project`: PASS (HTTP 200)

## Remaining Work
Code-side completion is done.
Remaining follow-up is product acceptance in a real browser against live external data sources.
