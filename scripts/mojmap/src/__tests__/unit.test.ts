/**
 * Pure-function tests for the MOJMAP pipeline. Run via Node 20's built-in
 * test runner with tsx:
 *
 *   node --import tsx --test scripts/mojmap/src/__tests__/unit.test.ts
 *
 * or, from within scripts/mojmap, `pnpm run test:unit`.
 *
 * No network, no filesystem writes — only logic that must stay correct.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveZone, epsgForZone, epsgForMunicipality } from '../crs.js';
import { isPhase1, PHASE1_CODES } from '../phase1.js';
import { extractMunicipalityCode } from '../ckan.js';
import { planUpdates, emptyManifest, applyResults } from '../manifest.js';
import { loadConfig } from '../config.js';
import type { ResolvedDataset } from '../types.js';

test('resolveZone — Tokyo 23区 maps to zone 9', () => {
  assert.equal(resolveZone('13101'), 9);
  assert.equal(resolveZone('13104'), 9);
  assert.equal(resolveZone('13123'), 9);
});

test('resolveZone — Osaka maps to zone 6', () => {
  assert.equal(resolveZone('27103'), 6);
});

test('resolveZone — Sapporo (default for 01*) maps to zone 12', () => {
  assert.equal(resolveZone('01101'), 12);
  assert.equal(resolveZone('01103'), 12);
});

test('resolveZone — municipality override beats prefecture default', () => {
  // 01204 (函館) — per crs_map.json override → zone 13
  assert.equal(resolveZone('01204'), 13);
  // 01202 (小樽) — override → zone 11
  assert.equal(resolveZone('01202'), 11);
});

test('resolveZone — invalid code throws', () => {
  assert.throws(() => resolveZone('123'), /invalid municipality code/);
  assert.throws(() => resolveZone('abcde'), /invalid municipality code/);
});

test('epsgForZone — 1..19 map to 6669..6687', () => {
  assert.equal(epsgForZone(1), 6669);
  assert.equal(epsgForZone(9), 6677);
  assert.equal(epsgForZone(19), 6687);
  assert.throws(() => epsgForZone(0), /zone out of range/);
  assert.throws(() => epsgForZone(20), /zone out of range/);
});

test('epsgForMunicipality end-to-end', () => {
  assert.equal(epsgForMunicipality('13104'), 6677);
  assert.equal(epsgForMunicipality('27103'), 6674);
});

test('isPhase1 — accepts Tokyo 23区, rejects unknown codes', () => {
  assert.equal(isPhase1('13101'), true);
  assert.equal(isPhase1('13123'), true);
  // 13362 (三宅村) is not in Phase 1
  assert.equal(isPhase1('13362'), false);
  assert.equal(isPhase1(null), false);
  assert.equal(isPhase1(undefined), false);
  assert.equal(isPhase1('99999'), false);
});

test('PHASE1_CODES size is non-trivial', () => {
  assert.ok(PHASE1_CODES.size > 50, 'expected at least 50 Phase 1 codes');
});

test('extractMunicipalityCode — prefers extras with canonical key', () => {
  const pkg = {
    id: 'x',
    name: 'foo',
    title: 'bar',
    metadata_modified: '2026-04-15T00:00:00Z',
    resources: [],
    extras: [{ key: '全国地方公共団体コード', value: '13104' }],
  };
  assert.equal(extractMunicipalityCode(pkg), '13104');
});

test('extractMunicipalityCode — falls back to a 5-digit tag', () => {
  const pkg = {
    id: 'x',
    name: 'foo',
    title: 'bar',
    metadata_modified: '2026-04-15T00:00:00Z',
    resources: [],
    tags: [{ name: '東京都' }, { name: '13102' }],
  };
  assert.equal(extractMunicipalityCode(pkg), '13102');
});

test('extractMunicipalityCode — title regex fallback avoids 6-digit false match', () => {
  const pkg = {
    id: 'x',
    name: 'foo',
    title: 'ID 123456 東京都新宿区 13104',
    metadata_modified: '2026-04-15T00:00:00Z',
    resources: [],
  };
  // The `123456` contains a 5-digit run (12345/23456) but both are preceded
  // or followed by a digit, so neither must match. `13104` is standalone.
  assert.equal(extractMunicipalityCode(pkg), '13104');
});

test('planUpdates — new dataset is always planned', () => {
  const cfg = loadConfig({ forceFull: false });
  const manifest = emptyManifest();
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = planUpdates(cfg, manifest, [ds]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].reason, 'new');
});

test('planUpdates — unchanged manifest entry is not re-planned', () => {
  const cfg = loadConfig({ forceFull: false });
  const manifest = emptyManifest();
  manifest.datasets.a = {
    ckanId: 'ckan-a',
    ckanModified: '2026-04-15T00:00:00Z',
    zipSha256: 'abc',
    featureCount: 10,
    ingestedAt: '2026-04-15T03:00:00Z',
  };
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = planUpdates(cfg, manifest, [ds]);
  assert.equal(plans.length, 0);
});

test('planUpdates — modified ckanModified triggers re-plan', () => {
  const cfg = loadConfig({ forceFull: false });
  const manifest = emptyManifest();
  manifest.datasets.a = {
    ckanId: 'ckan-a',
    ckanModified: '2026-04-14T00:00:00Z',
    zipSha256: 'abc',
    featureCount: 10,
    ingestedAt: '2026-04-14T03:00:00Z',
  };
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = planUpdates(cfg, manifest, [ds]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].reason, 'modified');
  assert.equal(plans[0].previousZipSha256, 'abc');
});

test('planUpdates — forceFull picks every dataset', () => {
  const cfg = loadConfig({ forceFull: true });
  const manifest = emptyManifest();
  manifest.datasets.a = {
    ckanId: 'ckan-a',
    ckanModified: '2026-04-15T00:00:00Z',
    zipSha256: 'abc',
    featureCount: 10,
    ingestedAt: '2026-04-15T03:00:00Z',
  };
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = planUpdates(cfg, manifest, [ds]);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].reason, 'forced');
});

test('planUpdates — failure retry after 25h grace', () => {
  const cfg = loadConfig({ forceFull: false });
  const manifest = emptyManifest();
  const now = new Date('2026-04-16T04:00:00Z');
  const prevIngested = new Date(now.getTime() - 26 * 60 * 60 * 1000);
  manifest.datasets.a = {
    ckanId: 'ckan-a',
    ckanModified: '2026-04-15T00:00:00Z',
    zipSha256: 'abc',
    featureCount: 0,
    ingestedAt: prevIngested.toISOString(),
    failureStreak: 2,
    lastError: 'boom',
  };
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = planUpdates(cfg, manifest, [ds], now);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].reason, 'retry');
});

test('applyResults — success writes full entry; failure increments streak', () => {
  const manifest = emptyManifest();
  manifest.datasets.a = {
    ckanId: 'ckan-a',
    ckanModified: '2026-04-14T00:00:00Z',
    zipSha256: 'old',
    featureCount: 1,
    ingestedAt: '2026-04-14T03:00:00Z',
  };
  const ds: ResolvedDataset = {
    id: 'a',
    ckanId: 'ckan-a',
    name: 'a',
    title: 'A',
    ckanModified: '2026-04-15T00:00:00Z',
    municipalityCode: '13104',
    zipUrl: 'https://example/x.zip',
    zipResourceId: 'r',
  };
  const plans = [{ dataset: ds, reason: 'modified' as const, previousZipSha256: 'old' }];
  const now = new Date('2026-04-15T03:00:00Z');
  const updated = applyResults(
    manifest,
    [{ datasetId: 'a', ok: true, zipSha256: 'new', featureCount: 42 }],
    plans,
    now,
  );
  assert.equal(updated.datasets.a.zipSha256, 'new');
  assert.equal(updated.datasets.a.featureCount, 42);
  assert.equal(updated.datasets.a.ckanModified, '2026-04-15T00:00:00Z');
  assert.equal(updated.datasets.a.failureStreak, undefined);

  const failed = applyResults(
    manifest,
    [{ datasetId: 'a', ok: false, error: 'parse failed' }],
    plans,
    now,
  );
  assert.equal(failed.datasets.a.failureStreak, 1);
  // ckanModified kept at prior successful value so a retry can be planned later.
  assert.equal(failed.datasets.a.ckanModified, '2026-04-14T00:00:00Z');
  assert.equal(failed.datasets.a.lastError, 'parse failed');
});
