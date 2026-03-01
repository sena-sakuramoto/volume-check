'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { SiteBoundary, Road, ZoningData, ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
import { useVolumeCalculation } from '@/hooks/useVolumeCalculation';
import { useShadow } from '@/hooks/useShadow';
import { useAutoSave, loadProject } from '@/hooks/useAutoSave';
import { useViewerStore } from '@/stores/useViewerStore';
import { DEMO_SITE, DEMO_ROADS, DEMO_ZONING } from '@/lib/demo-data';
import { Sidebar } from '@/components/sidebar/Sidebar';
import type { Step } from '@/components/sidebar/SidebarStepper';
import { SiteSection } from '@/components/sidebar/SiteSection';
import { ZoningSection } from '@/components/sidebar/ZoningSection';
import { ResultsSection } from '@/components/sidebar/ResultsSection';
import { LayerPresetBar } from '@/components/layers/LayerPresetBar';
import { HeroMetrics } from '@/components/results/HeroMetrics';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { MobileStepper } from '@/components/mobile/MobileStepper';
import { PrintReport } from '@/components/ui/PrintReport';
import { Slider } from '@/components/ui/shadcn/slider';
import type { RoadConfig } from '@/components/site/site-types';
import { buildZoningData } from '@/components/site/site-helpers';

const Viewer = dynamic(
  () => import('@/components/three/Viewer').then((m) => ({ default: m.Viewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground">
        3Dビューを読み込み中...
      </div>
    ),
  },
);

function getInitialSavedProject() {
  if (typeof window === 'undefined') return null;
  return loadProject();
}

export default function ProjectPage() {
  const initialSavedProject = useMemo(() => getInitialSavedProject(), []);

  // Core state
  const [site, setSite] = useState<SiteBoundary | null>(() => initialSavedProject?.site ?? null);
  const [roads, setRoads] = useState<Road[]>(() => initialSavedProject?.roads ?? []);
  const [zoning, setZoning] = useState<ZoningData | null>(() => initialSavedProject?.zoning ?? null);
  const [latitude, setLatitude] = useState(() => initialSavedProject?.latitude ?? 35.68);
  const [floorHeights, setFloorHeights] = useState<number[]>(() => initialSavedProject?.floorHeights ?? []);
  const { layers, shadowTimeValue, setShadowTime: setShadowTimeValue } = useViewerStore();

  // UI state
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Zoning editor state (lifted for cross-step coordination)
  const [selectedDistrict, setSelectedDistrict] = useState<ZoningDistrict | null>(null);
  const [coverageOverride, setCoverageOverride] = useState('');
  const [farOverride, setFarOverride] = useState('');
  const [fireDistrict, setFireDistrict] = useState<FireDistrict>('指定なし');
  const [heightDistrictType, setHeightDistrictType] = useState<HeightDistrict['type']>('指定なし');
  const [isCornerLot, setIsCornerLot] = useState(false);
  const [roadConfigs, setRoadConfigs] = useState<RoadConfig[]>([
    { id: '1', width: 6, direction: 'south', customWidth: '' },
  ]);

  // Hooks
  const { volumeResult, calcError, effectiveFloorHeights } = useVolumeCalculation({
    site, zoning, roads, latitude, floorHeights,
  });
  const { shadowTime, shadowMask } = useShadow({
    shadowTimeValue,
    volumeResult,
    site,
    zoning,
    latitude,
    showTimeShadow: layers.shadowTimeShadow,
  });
  useAutoSave({ site, roads, zoning, latitude, floorHeights });

  // Auto-advance only on initial load (when saved project is restored)
  const [hasNavigated, setHasNavigated] = useState(false);
  const resolvedActiveStep = useMemo<Step>(() => {
    if (hasNavigated) return activeStep;
    if (activeStep < 2 && site && roads.length > 0) return 2;
    if (activeStep < 3 && zoning && volumeResult) return 3;
    return activeStep;
  }, [activeStep, site, roads, zoning, volumeResult, hasNavigated]);

  const handleStepChange = useCallback((step: Step) => {
    setHasNavigated(true);
    setActiveStep(step);
  }, []);

  // Consolidated zoning rebuild helper
  const rebuildZoning = useCallback((overrides: {
    dist?: ZoningDistrict; cov?: string; far?: string;
    fire?: FireDistrict; hd?: HeightDistrict['type']; corner?: boolean;
  } = {}) => {
    const dist = overrides.dist ?? selectedDistrict;
    if (!dist) return;
    const cov = overrides.cov ?? coverageOverride;
    const far = overrides.far ?? farOverride;
    setZoning(buildZoningData(dist, {
      coverageRatio: cov ? parseFloat(cov) / 100 : undefined,
      floorAreaRatio: far ? parseFloat(far) / 100 : undefined,
      fireDistrict: overrides.fire ?? fireDistrict,
      heightDistrict: { type: overrides.hd ?? heightDistrictType },
      isCornerLot: overrides.corner ?? isCornerLot,
    }));
  }, [selectedDistrict, coverageOverride, farOverride, fireDistrict, heightDistrictType, isCornerLot]);

  const handleDistrictChange = useCallback((d: ZoningDistrict) => {
    setSelectedDistrict(d); rebuildZoning({ dist: d });
  }, [rebuildZoning]);
  const handleCoverageChange = useCallback((v: string) => {
    setCoverageOverride(v); rebuildZoning({ cov: v });
  }, [rebuildZoning]);
  const handleFarChange = useCallback((v: string) => {
    setFarOverride(v); rebuildZoning({ far: v });
  }, [rebuildZoning]);
  const handleFireDistrictChange = useCallback((f: FireDistrict) => {
    setFireDistrict(f); rebuildZoning({ fire: f });
  }, [rebuildZoning]);
  const handleHeightDistrictChange = useCallback((h: HeightDistrict['type']) => {
    setHeightDistrictType(h); rebuildZoning({ hd: h });
  }, [rebuildZoning]);
  const handleCornerLotChange = useCallback((v: boolean) => {
    setIsCornerLot(v); rebuildZoning({ corner: v });
  }, [rebuildZoning]);

  const handleLoadDemo = useCallback(() => {
    setSite(DEMO_SITE);
    setRoads(DEMO_ROADS);
    setZoning(DEMO_ZONING);
    setHasNavigated(true);
    setActiveStep(3);
  }, []);

  const completedSteps = useMemo(() => ({
    1: !!site && roads.length > 0,
    2: !!zoning,
    3: !!volumeResult,
  }), [site, roads, zoning, volumeResult]);

  // Sidebar content by step
  const sidebarContent = (
    <>
      {resolvedActiveStep === 1 && (
        <SiteSection
          site={site}
          onSiteChange={setSite}
          onRoadsChange={setRoads}
          onZoningChange={setZoning}
          onLatitudeChange={setLatitude}
          onLoadDemo={handleLoadDemo}
          selectedDistrict={selectedDistrict}
          onDistrictChange={handleDistrictChange}
          coverageOverride={coverageOverride}
          onCoverageChange={handleCoverageChange}
          farOverride={farOverride}
          onFarChange={handleFarChange}
          fireDistrict={fireDistrict}
          onFireDistrictChange={handleFireDistrictChange}
          heightDistrictType={heightDistrictType}
          isCornerLot={isCornerLot}
          onCornerLotChange={handleCornerLotChange}
          roadConfigs={roadConfigs}
          onRoadConfigsChange={setRoadConfigs}
        />
      )}
      {resolvedActiveStep === 2 && (
        <ZoningSection
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
      )}
      {resolvedActiveStep === 3 && (
        <ResultsSection
          zoning={zoning}
          result={volumeResult}
          site={site}
          roads={roads}
          floorHeights={effectiveFloorHeights}
          latitude={latitude}
          onFloorHeightsChange={setFloorHeights}
        />
      )}
    </>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden no-print">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 text-[15px] font-bold text-primary-foreground shadow-[0_8px_24px_rgba(93,228,199,0.3)]">
            V
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground font-display">VolumeCheck</h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              住所から法規制と最大ボリュームを数分で。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          beta
        </span>
      </header>

      {/* ============ DESKTOP LAYOUT (md+) ============ */}
      <div className="hidden md:flex flex-1 gap-3 px-4 pb-4 overflow-hidden">
        <Sidebar
          activeStep={resolvedActiveStep}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        >
          {sidebarContent}
        </Sidebar>

        {/* 3D Scene */}
        <main className="app-panel flex-1 relative overflow-hidden">
          {calcError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-destructive/90 border border-destructive px-4 py-2 text-xs text-destructive-foreground shadow-lg">
              {calcError}
            </div>
          )}

          <LayerPresetBar />

          {/* Shadow time slider */}
          {layers.shadowTimeShadow && (
            <div className="absolute top-3 right-3 z-20 w-48 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-3 shadow-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-muted-foreground">日影時刻</span>
                <span className="text-xs font-mono text-foreground">
                  {shadowTime.hour}:{String(shadowTime.minute).padStart(2, '0')}
                </span>
              </div>
              <Slider
                value={[shadowTimeValue]}
                onValueChange={([v]) => setShadowTimeValue(v)}
                min={0}
                max={480}
                step={10}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>8:00</span>
                <span>12:00</span>
                <span>16:00</span>
              </div>
            </div>
          )}

          {/* Hero Metrics floating */}
          {volumeResult && (
            <HeroMetrics
              result={volumeResult}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
            />
          )}

          <Viewer
            site={site}
            roads={roads}
            zoning={zoning}
            volumeResult={volumeResult}
            floorHeights={effectiveFloorHeights}
            shadowTime={layers.shadowTimeShadow ? shadowTime : null}
            shadowMask={shadowMask}
          />
        </main>
      </div>

      {/* ============ MOBILE LAYOUT (<md) ============ */}
      <div className="flex md:hidden flex-1 relative overflow-hidden">
        {/* Full-screen 3D */}
        <div className="absolute inset-0">
          <Viewer
            site={site}
            roads={roads}
            zoning={zoning}
            volumeResult={volumeResult}
            floorHeights={effectiveFloorHeights}
            shadowTime={layers.shadowTimeShadow ? shadowTime : null}
            shadowMask={shadowMask}
          />
        </div>

        {calcError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-full bg-destructive/90 border border-destructive px-4 py-2 text-xs text-destructive-foreground shadow-lg">
            {calcError}
          </div>
        )}

        {/* Floating layer preset bar */}
        <LayerPresetBar />

        {/* Floating hero metrics */}
        {volumeResult && (
          <HeroMetrics
            result={volumeResult}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-10 scale-90"
          />
        )}

        {/* Bottom Sheet */}
        <BottomSheet>
          <MobileStepper activeStep={resolvedActiveStep} onStepChange={handleStepChange} />
          {sidebarContent}
        </BottomSheet>
      </div>

      {/* Print report (hidden) */}
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
