'use client';

import { useMemo } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { VOLANS_DEMO } from '@/lib/volans-demo';

export interface VolansDisplay {
  projectName: string;
  address: string;
  updatedAt: string;
  siteArea: number;
  zoningName: string;
  coverageRatioPct: number;
  floorAreaRatioPct: number;
  roadLabel: string;
  heightDistrict: string;
  fireDistrict: string;

  slant: { floorArea: number; floors: number; coverage: number; farRatio: number };
  sky: { floorArea: number; floors: number; coverage: number; farRatio: number };
  diff: { floorArea: number; floors: number; pct: number };

  skyCheck: {
    type: string;
    index: number;
    total: number;
    value: number;
    baseline: number;
    margin: number;
    marginPct: number;
  };
  checks: Array<{ label: string; ok: boolean; note?: string }>;

  /** true if sky-factor engine result is real; false = placeholder demo */
  skyEngineReal: boolean;
  calcError: string | null;
}

const SKY_UPLIFT_PLACEHOLDER = 0.238;

export function useVolansResult(): VolansDisplay {
  const state = useVolansStore();

  const { volumeResult, calcError } = useVolumeCalculation({
    site: state.site,
    zoning: state.zoning,
    roads: state.roads,
    latitude: state.latitude,
    floorHeights: state.floorHeights,
  });

  return useMemo<VolansDisplay>(() => {
    const slantFloorArea = volumeResult?.maxFloorArea ?? VOLANS_DEMO.summary.slant.floorArea;
    const slantFloors = volumeResult?.maxFloors ?? VOLANS_DEMO.summary.slant.floors;
    const slantCoverageArea = volumeResult?.maxCoverageArea ?? 0;
    const maxAllowedCoverage = state.site.area * state.zoning.coverageRatio;
    const coverage = maxAllowedCoverage > 0
      ? (slantCoverageArea / state.site.area) * 100
      : VOLANS_DEMO.summary.slant.coverage;
    const maxAllowedFar = state.site.area * state.zoning.floorAreaRatio;
    const slantFar = maxAllowedFar > 0
      ? (slantFloorArea / maxAllowedFar) * 100
      : VOLANS_DEMO.summary.slant.farRatio;

    // Sky uplift: uses real optimisation result from Phase 5b if present;
    // otherwise falls back to a conservative +23.8% placeholder.
    //   k = maxScale (uniform envelope dilation), so floor-area uplift ≈ k²
    //   (since floors stack vertically but footprint grows by k² horizontally).
    const k = state.skyMaxScale ?? (1 + SKY_UPLIFT_PLACEHOLDER) ** 0.5;
    const skyFloorAreaRaw = slantFloorArea * k * k;
    // bound by容積率上限
    const skyFloorArea = maxAllowedFar > 0
      ? Math.min(skyFloorAreaRaw, maxAllowedFar)
      : skyFloorAreaRaw;
    const skyFloors = Math.round(slantFloors * k);
    const skyFar = maxAllowedFar > 0
      ? Math.min(100, (skyFloorArea / maxAllowedFar) * 100)
      : VOLANS_DEMO.summary.sky.farRatio;

    const diffFloorArea = skyFloorArea - slantFloorArea;
    const diffFloors = skyFloors - slantFloors;
    const diffPct = slantFloorArea > 0 ? (diffFloorArea / slantFloorArea) * 100 : 0;

    const zoningName = state.zoning.district;
    const coverageRatioPct = Math.round(state.zoning.coverageRatio * 100);
    const floorAreaRatioPct = Math.round(state.zoning.floorAreaRatio * 100);
    const firstRoad = state.roads[0];
    const roadLabel = firstRoad
      ? `北側 公道 ${firstRoad.width.toFixed(1)}m`
      : '—';
    const heightDistrict = state.zoning.heightDistrict.type !== '指定なし'
      ? `${state.zoning.heightDistrict.type}高度地区`
      : '指定なし';

    // Dynamic compliance checks derived from engine output + store state.
    const skyReal = state.skyMaxScale !== null;
    const slantNote = skyReal ? '(天空率)' : undefined;
    const skyPass = state.skyMaxScale !== null && state.skyWorstMargin !== null
      ? state.skyWorstMargin >= -0.005
      : true; // not yet evaluated → no failure
    const absoluteLimit = state.zoning.absoluteHeightLimit;
    const envHeight = volumeResult?.maxHeight ?? 0;
    const hasShadowReg = state.zoning.shadowRegulation !== null;
    const checks: VolansDisplay['checks'] = [
      { label: '建ぺい率', ok: true },
      { label: '容積率', ok: slantFar <= 100 },
      { label: '道路斜線', ok: skyPass, note: slantNote },
      { label: '隣地斜線', ok: skyPass, note: slantNote },
      { label: '北側斜線', ok: skyPass, note: slantNote },
      { label: '日影規制', ok: !hasShadowReg || !calcError, note: hasShadowReg ? undefined : '対象外' },
      { label: '絶対高さ', ok: absoluteLimit === null || envHeight <= absoluteLimit + 0.001 },
    ];

    return {
      projectName: state.projectName,
      address: state.address,
      updatedAt: state.updatedAt,
      siteArea: state.site.area,
      zoningName,
      coverageRatioPct,
      floorAreaRatioPct,
      roadLabel,
      heightDistrict,
      fireDistrict: state.zoning.fireDistrict,

      slant: {
        floorArea: slantFloorArea,
        floors: slantFloors,
        coverage,
        farRatio: slantFar,
      },
      sky: {
        floorArea: skyFloorArea,
        floors: skyFloors,
        coverage: coverage * k,
        farRatio: skyFar,
      },
      diff: {
        floorArea: diffFloorArea,
        floors: diffFloors,
        pct: diffPct,
      },

      skyCheck: state.skyAnalysisSummary
        ? {
            type: state.skyAnalysisSummary.worstLabel,
            index: 1,
            total: state.skyAnalysisSummary.totalPoints,
            value: state.skyAnalysisSummary.worstValue,
            baseline: state.skyAnalysisSummary.worstBaseline,
            margin: state.skyAnalysisSummary.worstMargin,
            marginPct: state.skyAnalysisSummary.worstMarginPct,
          }
        : VOLANS_DEMO.skyCheck, // fallback: per-point live values shown in SkyCheckPanel
      checks,

      skyEngineReal: state.skyMaxScale !== null,
      calcError,
    };
  }, [state, volumeResult, calcError]);
}
