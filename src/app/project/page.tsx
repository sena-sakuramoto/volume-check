'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  FireDistrict,
  HeightDistrict,
  Road,
  SiteBoundary,
  ZoningData,
  ZoningDistrict,
} from '@/engine/types';
import { LayerPresetBar } from '@/components/layers/LayerPresetBar';
import { MobileStepper } from '@/components/mobile/MobileStepper';
import { HeroMetrics } from '@/components/results/HeroMetrics';
import { ResultsSection } from '@/components/sidebar/ResultsSection';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { SiteSection } from '@/components/sidebar/SiteSection';
import type { Step } from '@/components/sidebar/SidebarStepper';
import { ZoningSection } from '@/components/sidebar/ZoningSection';
import type {
  RoadConfig,
  RoadDirection,
  RoadReviewStatus,
  RoadSource,
  SitePrecision,
} from '@/components/site/site-types';
import {
  getSitePrecisionHint,
  getSitePrecisionLabel,
} from '@/components/site/site-types';
import { buildZoningData } from '@/components/site/site-helpers';
import { PrintReport } from '@/components/ui/PrintReport';
import { Button } from '@/components/ui/shadcn/button';
import { Slider } from '@/components/ui/shadcn/slider';
import { useAutoSave, loadProject } from '@/hooks/useAutoSave';
import { useShadow } from '@/hooks/useShadow';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { DEMO_INPUT, DEMO_ROADS, DEMO_SITE, DEMO_ZONING } from '@/lib/demo-data';
import { useViewerStore } from '@/stores/useViewerStore';

const Viewer = dynamic(
  () => import('@/components/three/Viewer').then((module) => ({ default: module.Viewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-background text-muted-foreground">
        3Dビューを読み込み中...
      </div>
    ),
  },
);

function createDefaultRoadConfigs(): RoadConfig[] {
  return [
    {
      id: '1',
      width: 6,
      direction: 'south',
      customWidth: '',
      source: 'manual',
      reviewStatus: 'confirmed',
    },
  ];
}

function bearingToRoadDirection(bearing: number): RoadDirection {
  const options: Array<{ dir: RoadDirection; bearing: number }> = [
    { dir: 'north', bearing: 0 },
    { dir: 'east', bearing: 90 },
    { dir: 'south', bearing: 180 },
    { dir: 'west', bearing: 270 },
  ];

  const normalized = ((bearing % 360) + 360) % 360;
  let best = options[0];
  let bestDelta = Infinity;

  for (const option of options) {
    const delta = Math.min(
      Math.abs(normalized - option.bearing),
      360 - Math.abs(normalized - option.bearing),
    );
    if (delta < bestDelta) {
      best = option;
      bestDelta = delta;
    }
  }

  return best.dir;
}

function buildRoadConfigs(
  roads: Road[],
  options?: { source?: RoadSource; reviewStatus?: RoadReviewStatus },
): RoadConfig[] {
  if (roads.length === 0) return createDefaultRoadConfigs();

  return roads.map((road, index) => ({
    id: String(index + 1),
    width: road.width,
    direction: bearingToRoadDirection(road.bearing),
    customWidth: '',
    source: options?.source ?? 'manual',
    reviewStatus: options?.reviewStatus ?? 'confirmed',
    frontSetback: road.frontSetback,
    oppositeSideSetback: road.oppositeSideSetback,
    oppositeOpenSpace: road.oppositeOpenSpace,
    oppositeOpenSpaceKind: road.oppositeOpenSpaceKind,
    slopeWidthOverride: road.slopeWidthOverride,
    siteHeightAboveRoad: road.siteHeightAboveRoad,
    enableTwoA35m: road.enableTwoA35m,
  }));
}

const MOBILE_STEP_META: Record<Step, { eyebrow: string; title: string; description: string }> = {
  1: {
    eyebrow: 'Step 1',
    title: '敷地と道路条件',
    description: '住所検索、図面読取、手入力から敷地を固めて、最後に接道条件を確認します。',
  },
  2: {
    eyebrow: 'Step 2',
    title: '法規条件を整える',
    description: '用途地域、建ぺい率、容積率、高度地区を確認して、数字を確定します。',
  },
  3: {
    eyebrow: 'Step 3',
    title: '結果を確認する',
    description: '最大ボリューム、事業性、PDF 出力までをまとめて確認します。',
  },
};

export default function ProjectPage() {
  const [disable3D, setDisable3D] = useState(false);
  const [site, setSite] = useState<SiteBoundary | null>(null);
  const [sitePrecision, setSitePrecision] = useState<SitePrecision>('reference');
  const [roads, setRoads] = useState<Road[]>([]);
  const [zoning, setZoning] = useState<ZoningData | null>(null);
  const [latitude, setLatitude] = useState(35.68);
  const [floorHeights, setFloorHeights] = useState<number[]>([]);

  const [activeStep, setActiveStep] = useState<Step>(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileViewerOpen, setMobileViewerOpen] = useState(false);

  const [selectedDistrict, setSelectedDistrict] = useState<ZoningDistrict | null>(null);
  const [coverageOverride, setCoverageOverride] = useState('');
  const [farOverride, setFarOverride] = useState('');
  const [fireDistrict, setFireDistrict] = useState<FireDistrict>(DEMO_ZONING.fireDistrict);
  const [heightDistrictType, setHeightDistrictType] = useState<HeightDistrict['type']>(DEMO_ZONING.heightDistrict.type);
  const [isCornerLot, setIsCornerLot] = useState(false);
  const [roadConfigs, setRoadConfigs] = useState<RoadConfig[]>(createDefaultRoadConfigs);

  const { layers, shadowTimeValue, setShadowTime: setShadowTimeValue } = useViewerStore();

  const syncDisable3DPreference = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    setDisable3D(params.get('no3d') === '1');
  }, []);

  useEffect(() => {
    queueMicrotask(syncDisable3DPreference);
  }, [syncDisable3DPreference]);

  const roadsConfirmed = useMemo(
    () =>
      roadConfigs.length > 0 &&
      roadConfigs.every((config) => (config.reviewStatus ?? 'confirmed') === 'confirmed'),
    [roadConfigs],
  );

  const restoreSavedProject = useCallback(() => {
    const saved = loadProject();
    if (!saved) return;

    setSite(saved.site);
    setSitePrecision(saved.sitePrecision ?? 'reference');
    setRoads(saved.roads);
    setZoning(saved.zoning);
    setLatitude(saved.latitude);
    setFloorHeights(Array.isArray(saved.floorHeights) ? saved.floorHeights : []);

    if (saved.zoning) {
      setSelectedDistrict(saved.zoning.district);
      setCoverageOverride(String(Math.round(saved.zoning.coverageRatio * 100)));
      setFarOverride(String(Math.round(saved.zoning.floorAreaRatio * 100)));
      setFireDistrict(saved.zoning.fireDistrict);
      setHeightDistrictType(saved.zoning.heightDistrict.type);
      setIsCornerLot(saved.zoning.isCornerLot);
    }

    setRoadConfigs(
      Array.isArray(saved.roadConfigs) && saved.roadConfigs.length > 0
        ? saved.roadConfigs.map((config, index) => ({
            ...config,
            id: config.id || String(index + 1),
            source: config.source ?? 'manual',
            reviewStatus: config.reviewStatus ?? 'confirmed',
          }))
        : buildRoadConfigs(saved.roads),
    );
  }, []);

  useEffect(() => {
    queueMicrotask(restoreSavedProject);
  }, [restoreSavedProject]);

  const { volumeResult, calcError, effectiveFloorHeights } = useVolumeCalculation({
    site,
    zoning,
    roads,
    latitude,
    floorHeights,
  });

  const { shadowTime, shadowMask } = useShadow({
    shadowTimeValue,
    volumeResult,
    site,
    zoning,
    latitude,
    showTimeShadow: layers.shadowTimeShadow,
  });

  useAutoSave({ site, roads, zoning, latitude, floorHeights, roadConfigs, sitePrecision });

  const [hasNavigated, setHasNavigated] = useState(false);
  const resolvedActiveStep = useMemo<Step>(() => {
    if (hasNavigated) return activeStep;
    if (activeStep < 2 && site && roads.length > 0 && roadsConfirmed) return 2;
    if (activeStep < 3 && zoning && volumeResult && roadsConfirmed) return 3;
    return activeStep;
  }, [activeStep, hasNavigated, roads.length, roadsConfirmed, site, volumeResult, zoning]);

  const completedSteps = useMemo(
    () => ({
      1: !!site && roads.length > 0 && roadsConfirmed,
      2: !!zoning,
      3: !!volumeResult,
    }),
    [roads.length, roadsConfirmed, site, volumeResult, zoning],
  );

  const readySteps = useMemo(
    () => ({
      1: true,
      2: completedSteps[1],
      3: completedSteps[1] && completedSteps[2],
    }),
    [completedSteps],
  );

  const activeStepNotice = useMemo(() => {
    if (resolvedActiveStep === 2 && !completedSteps[1]) {
      return 'Step 2 は先に確認できます。戻って Step 1 の敷地と接道を確定すると計算が安定します。';
    }

    if (resolvedActiveStep === 3) {
      const missing: string[] = [];
      if (!completedSteps[1]) missing.push('敷地と道路');
      if (!completedSteps[2]) missing.push('法規設定');
      if (missing.length > 0) {
        return `${missing.join(' / ')} が未完了です。先に見ても構いませんが、結果は途中状態として読んでください。`;
      }
    }

    return null;
  }, [completedSteps, resolvedActiveStep]);

  const mobileStepMeta = MOBILE_STEP_META[resolvedActiveStep];

  const handleStepChange = useCallback((step: Step) => {
    setHasNavigated(true);
    setActiveStep(step);
    setMobileViewerOpen(false);
  }, []);

  const rebuildZoning = useCallback((overrides: {
    dist?: ZoningDistrict;
    cov?: string;
    far?: string;
    fire?: FireDistrict;
    hd?: HeightDistrict['type'];
    corner?: boolean;
  } = {}) => {
    const dist = overrides.dist ?? selectedDistrict;
    if (!dist) return;

    const cov = overrides.cov ?? coverageOverride;
    const far = overrides.far ?? farOverride;
    const nextHeightType = overrides.hd ?? zoning?.heightDistrict?.type ?? heightDistrictType;
    const nextHeightDistrict =
      overrides.hd === undefined && zoning?.heightDistrict?.autoDetected
        ? zoning.heightDistrict
        : { type: nextHeightType };

    setZoning(buildZoningData(dist, {
      coverageRatio: cov ? parseFloat(cov) / 100 : undefined,
      floorAreaRatio: far ? parseFloat(far) / 100 : undefined,
      fireDistrict: overrides.fire ?? fireDistrict,
      heightDistrict: nextHeightDistrict,
      isCornerLot: overrides.corner ?? isCornerLot,
      districtPlan: overrides.dist ? null : zoning?.districtPlan ?? null,
    }));
  }, [coverageOverride, farOverride, fireDistrict, heightDistrictType, isCornerLot, selectedDistrict, zoning]);

  const handleDistrictChange = useCallback((district: ZoningDistrict) => {
    setSelectedDistrict(district);
    rebuildZoning({ dist: district });
  }, [rebuildZoning]);

  const handleCoverageChange = useCallback((value: string) => {
    setCoverageOverride(value);
    rebuildZoning({ cov: value });
  }, [rebuildZoning]);

  const handleFarChange = useCallback((value: string) => {
    setFarOverride(value);
    rebuildZoning({ far: value });
  }, [rebuildZoning]);

  const handleFireDistrictChange = useCallback((district: FireDistrict) => {
    setFireDistrict(district);
    rebuildZoning({ fire: district });
  }, [rebuildZoning]);

  const handleHeightDistrictChange = useCallback((district: HeightDistrict['type']) => {
    setHeightDistrictType(district);
    rebuildZoning({ hd: district });
  }, [rebuildZoning]);

  const handleCornerLotChange = useCallback((value: boolean) => {
    setIsCornerLot(value);
    rebuildZoning({ corner: value });
  }, [rebuildZoning]);

  const handleLoadDemoModel = useCallback(() => {
    const demoSite: SiteBoundary = {
      area: DEMO_SITE.area,
      vertices: DEMO_SITE.vertices.map((vertex) => ({ ...vertex })),
    };
    const demoRoads: Road[] = DEMO_ROADS.map((road) => ({
      ...road,
      edgeStart: { ...road.edgeStart },
      edgeEnd: { ...road.edgeEnd },
    }));
    const demoZoning: ZoningData = {
      ...DEMO_ZONING,
      heightDistrict: { ...DEMO_ZONING.heightDistrict },
      shadowRegulation: DEMO_ZONING.shadowRegulation ? { ...DEMO_ZONING.shadowRegulation } : null,
      districtPlan: DEMO_ZONING.districtPlan ? { ...DEMO_ZONING.districtPlan } : null,
    };

    setSelectedDistrict(demoZoning.district);
    setCoverageOverride(String(Math.round(demoZoning.coverageRatio * 100)));
    setFarOverride(String(Math.round(demoZoning.floorAreaRatio * 100)));
    setFireDistrict(demoZoning.fireDistrict);
    setHeightDistrictType(demoZoning.heightDistrict.type);
    setIsCornerLot(demoZoning.isCornerLot);
    setRoadConfigs(buildRoadConfigs(demoRoads, { source: 'demo', reviewStatus: 'confirmed' }));

    setSite(demoSite);
    setSitePrecision('reference');
    setRoads(demoRoads);
    setZoning(demoZoning);
    setLatitude(DEMO_INPUT.latitude);
    setHasNavigated(false);
    setActiveStep(1);
    setMobileViewerOpen(true);
  }, []);

  const sidebarContent = (
    <>
      {resolvedActiveStep === 1 ? (
        <SiteSection
          site={site}
          onSiteChange={setSite}
          sitePrecision={sitePrecision}
          onSitePrecisionChange={setSitePrecision}
          onRoadsChange={setRoads}
          onZoningChange={setZoning}
          onLatitudeChange={setLatitude}
          selectedDistrict={selectedDistrict}
          onDistrictChange={handleDistrictChange}
          coverageOverride={coverageOverride}
          onCoverageChange={handleCoverageChange}
          farOverride={farOverride}
          onFarChange={handleFarChange}
          fireDistrict={fireDistrict}
          onFireDistrictChange={handleFireDistrictChange}
          heightDistrictType={heightDistrictType}
          onHeightDistrictDetected={setHeightDistrictType}
          isCornerLot={isCornerLot}
          onCornerLotChange={handleCornerLotChange}
          roadConfigs={roadConfigs}
          onRoadConfigsChange={setRoadConfigs}
        />
      ) : null}
      {resolvedActiveStep === 2 ? (
        <ZoningSection
          zoning={zoning}
          selectedDistrict={selectedDistrict}
          onDistrictChange={handleDistrictChange}
          coverageOverride={coverageOverride}
          onCoverageChange={handleCoverageChange}
          farOverride={farOverride}
          onFarChange={handleFarChange}
          fireDistrict={fireDistrict}
          onFireDistrictChange={handleFireDistrictChange}
          heightDistrictType={heightDistrictType}
          onHeightDistrictChange={handleHeightDistrictChange}
          isCornerLot={isCornerLot}
          onCornerLotChange={handleCornerLotChange}
        />
      ) : null}
      {resolvedActiveStep === 3 ? (
        <ResultsSection
          zoning={zoning}
          result={volumeResult}
          site={site}
          sitePrecision={sitePrecision}
          roads={roads}
          floorHeights={effectiveFloorHeights}
          onFloorHeightsChange={setFloorHeights}
        />
      ) : null}
    </>
  );

  const viewerProps = {
    site,
    roads,
    zoning,
    volumeResult,
    floorHeights: effectiveFloorHeights,
    shadowTime: layers.shadowTimeShadow ? shadowTime : null,
    shadowMask,
  };

  const viewerNode = disable3D ? (
    <div className="flex h-full items-center justify-center bg-[#f4ede2] p-6 text-center text-slate-900">
      <div className="max-w-sm space-y-2">
        <p className="text-sm font-semibold">設定モードのため 3D 表示を停止中</p>
        <p className="text-xs text-slate-600">
          `?no3d=1` を付けて表示しています。画面が重い場合や WebGL / GPU まわりで不安定なときに使います。
        </p>
      </div>
    </div>
  ) : (
    <Viewer {...viewerProps} />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden no-print">
      <header className="relative z-10 flex items-start justify-between gap-3 px-3 pb-2 pt-4 md:items-center md:px-6 md:pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-[#19a59b] to-[#7bc6bf] text-[15px] font-bold text-primary-foreground shadow-[0_12px_28px_rgba(15,140,131,0.22)]">
            V
          </div>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/75 md:hidden">
              Mobile
            </p>
            <h1 className="font-display text-base font-semibold text-foreground">VolumeCheck</h1>
            <p className="text-[10px] leading-4 text-muted-foreground">
              住所から法規制と最大ボリュームを数分で。
            </p>
          </div>
        </div>
        {site ? (
          <div className="hidden rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] text-primary md:block">
            <span className="font-semibold">敷地 {getSitePrecisionLabel(sitePrecision)}</span>
            <span className="ml-1 text-primary/80">{getSitePrecisionHint(sitePrecision)}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={handleLoadDemoModel}>
            デモ
          </Button>
          <span className="hidden rounded-full border border-border/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shadow-sm md:inline-flex">
            beta
          </span>
        </div>
      </header>

      <div className="hidden flex-1 gap-3 overflow-hidden px-4 pb-4 md:flex">
        <Sidebar
          activeStep={resolvedActiveStep}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
          readySteps={readySteps}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        >
          {sidebarContent}
        </Sidebar>

        <main className="app-panel relative flex-1 overflow-hidden">
          {calcError ? (
            <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-rose-200 bg-rose-50/95 px-4 py-2 text-xs text-rose-900 shadow-lg">
              {calcError}
            </div>
          ) : null}

          {activeStepNotice ? (
            <div className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-xs text-amber-950 shadow-lg">
              {activeStepNotice}
            </div>
          ) : null}

          <div className="absolute right-3 top-3 z-30">
            <Button type="button" size="sm" variant="secondary" onClick={handleLoadDemoModel}>
              デモを表示
            </Button>
          </div>

          <LayerPresetBar />

          {layers.shadowTimeShadow ? (
            <div className="absolute right-3 top-3 z-20 w-48 rounded-xl border border-white/70 bg-white/80 p-3 shadow-[0_14px_32px_rgba(28,42,49,0.14)] backdrop-blur-sm">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">時刻</span>
                <span className="text-xs font-mono text-foreground">
                  {shadowTime.hour}:{String(shadowTime.minute).padStart(2, '0')}
                </span>
              </div>
              <Slider
                value={[shadowTimeValue]}
                onValueChange={([value]) => setShadowTimeValue(value)}
                min={0}
                max={480}
                step={10}
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>8:00</span>
                <span>12:00</span>
                <span>16:00</span>
              </div>
            </div>
          ) : null}

          {volumeResult ? (
            <HeroMetrics
              result={volumeResult}
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2"
            />
          ) : null}

          {viewerNode}
        </main>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-24 md:hidden">
        <div className="space-y-3 pb-4">
          <div className="ui-surface-soft px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                  {mobileStepMeta.eyebrow}
                </p>
                <h2 className="mt-2 text-sm font-semibold text-foreground">{mobileStepMeta.title}</h2>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {mobileStepMeta.description}
                </p>
                {site ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    敷地状態: <span className="font-semibold text-foreground">{getSitePrecisionLabel(sitePrecision)}</span>
                    {' · '}
                    {getSitePrecisionHint(sitePrecision)}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                {resolvedActiveStep} / 3
              </span>
            </div>
          </div>

          {calcError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/95 px-4 py-3 text-[11px] text-rose-900 shadow-sm">
              {calcError}
            </div>
          ) : null}

          {activeStepNotice ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-[11px] text-amber-950 shadow-sm">
              {activeStepNotice}
            </div>
          ) : null}

          <div className="sticky top-0 z-10 bg-[rgba(245,241,232,0.94)] pb-1 pt-1 backdrop-blur-sm">
            <MobileStepper
              activeStep={resolvedActiveStep}
              onStepChange={handleStepChange}
              completedSteps={completedSteps}
              readySteps={readySteps}
            />
          </div>

          <div className="app-panel overflow-hidden">
            {sidebarContent}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-30 flex gap-2 md:hidden">
        <Button
          type="button"
          onClick={() => setMobileViewerOpen(true)}
          className="flex-1"
          disabled={disable3D}
        >
          {volumeResult ? '3Dと結果を見る' : '3Dを開く'}
        </Button>
        <Button type="button" variant="secondary" onClick={handleLoadDemoModel} className="shrink-0">
          デモ
        </Button>
      </div>

      {mobileViewerOpen ? (
        <div className="fixed inset-0 z-40 bg-[rgba(27,42,49,0.18)] backdrop-blur-sm md:hidden">
          <div className="absolute inset-x-0 bottom-0 h-[78svh] rounded-t-[28px] border border-border/70 bg-[rgba(255,252,247,0.98)] shadow-[0_-18px_48px_rgba(24,37,43,0.18)]">
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                    3D Viewer
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">3Dで確認する</h3>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setMobileViewerOpen(false)}>
                  閉じる
                </Button>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="h-full bg-[#f4ede2]">{viewerNode}</div>
                <LayerPresetBar compact className="left-3 top-3" />
              </div>

              {layers.shadowTimeShadow ? (
                <div className="border-t border-border/70 px-3 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">時刻</span>
                    <span className="text-xs font-mono text-foreground">
                      {shadowTime.hour}:{String(shadowTime.minute).padStart(2, '0')}
                    </span>
                  </div>
                  <Slider
                    value={[shadowTimeValue]}
                    onValueChange={([value]) => setShadowTimeValue(value)}
                    min={0}
                    max={480}
                    step={10}
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>8:00</span>
                    <span>12:00</span>
                    <span>16:00</span>
                  </div>
                </div>
              ) : null}

              {volumeResult ? (
                <div className="border-t border-border/70 px-3 py-3">
                  <HeroMetrics result={volumeResult} compact />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <PrintReport
        zoning={zoning}
        result={volumeResult}
        siteArea={site?.area ?? null}
        floorHeights={effectiveFloorHeights}
        latitude={latitude}
      />
    </div>
  );
}
