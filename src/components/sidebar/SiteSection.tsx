'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  FireDistrict,
  HeightDistrict,
  Road,
  SiteBoundary,
  ZoningData,
  ZoningDistrict,
} from '@/engine/types';
import { AddressSearch } from '@/components/site/AddressSearch';
import { FileUpload } from '@/components/site/FileUpload';
import { SiteEditor } from '@/components/site/SiteEditor';
import { RoadEditor } from '@/components/site/RoadEditor';
import {
  getSitePrecisionHint,
  getSitePrecisionLabel,
} from '@/components/site/site-types';
import type {
  RoadCandidate,
  RoadConfig,
  RoadDirection,
  RoadSource,
  SitePrecision,
} from '@/components/site/site-types';
import {
  buildRectSite,
  buildRoad,
  buildRoadsFromPolygonConfigs,
  buildZoningData,
} from '@/components/site/site-helpers';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/cn';
import { DEMO_INPUT, DEMO_ROADS, DEMO_SITE, DEMO_ZONING } from '@/lib/demo-data';

interface SiteSectionProps {
  site: SiteBoundary | null;
  onSiteChange: (site: SiteBoundary) => void;
  sitePrecision: SitePrecision;
  onSitePrecisionChange: (precision: SitePrecision) => void;
  onRoadsChange: (roads: Road[]) => void;
  onZoningChange: (zoning: ZoningData) => void;
  onLatitudeChange: (lat: number) => void;
  selectedDistrict: ZoningDistrict | null;
  onDistrictChange: (d: ZoningDistrict) => void;
  coverageOverride: string;
  onCoverageChange: (v: string) => void;
  farOverride: string;
  onFarChange: (v: string) => void;
  fireDistrict: FireDistrict;
  onFireDistrictChange: (f: FireDistrict) => void;
  heightDistrictType: HeightDistrict['type'];
  onHeightDistrictDetected: (h: HeightDistrict['type']) => void;
  isCornerLot: boolean;
  onCornerLotChange: (v: boolean) => void;
  roadConfigs: RoadConfig[];
  onRoadConfigsChange: (configs: RoadConfig[]) => void;
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ui-surface space-y-4 px-4 py-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function isAxisAlignedRectSite(site: SiteBoundary | null): boolean {
  if (!site || site.vertices.length !== 4) return false;
  const uniqueX = Array.from(new Set(site.vertices.map((vertex) => vertex.x.toFixed(6))));
  const uniqueY = Array.from(new Set(site.vertices.map((vertex) => vertex.y.toFixed(6))));
  return uniqueX.length === 2 && uniqueY.length === 2;
}

export function SiteSection({
  site,
  onSiteChange,
  sitePrecision,
  onSitePrecisionChange,
  onRoadsChange,
  onZoningChange,
  onLatitudeChange,
  selectedDistrict,
  onDistrictChange,
  coverageOverride,
  onCoverageChange,
  farOverride,
  onFarChange,
  fireDistrict,
  onFireDistrictChange,
  heightDistrictType,
  onHeightDistrictDetected,
  isCornerLot,
  onCornerLotChange,
  roadConfigs,
  onRoadConfigsChange,
}: SiteSectionProps) {
  const [siteWidth, setSiteWidth] = useState('');
  const [siteDepth, setSiteDepth] = useState('');
  const [siteMode, setSiteMode] = useState<'rect' | 'polygon'>('rect');
  const [entryMode, setEntryMode] = useState<'address' | 'file' | 'manual'>('address');
  const [roadAssistSource, setRoadAssistSource] = useState<RoadSource | null>(null);
  const [roadAssistMessage, setRoadAssistMessage] = useState<string | null>(null);
  const [roadSuggestionSnapshot, setRoadSuggestionSnapshot] = useState<RoadConfig[] | null>(null);
  const [roadUndoSnapshot, setRoadUndoSnapshot] = useState<RoadConfig[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveSiteMode =
    entryMode !== 'manual' && site
      ? (isAxisAlignedRectSite(site) ? 'rect' : 'polygon')
      : siteMode;

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const bearingToDirection = useCallback((bearing: number): RoadDirection => {
    const options: Array<{ dir: RoadDirection; bearing: number }> = [
      { dir: 'north', bearing: 0 },
      { dir: 'east', bearing: 90 },
      { dir: 'south', bearing: 180 },
      { dir: 'west', bearing: 270 },
    ];
    const normalized = ((bearing % 360) + 360) % 360;
    let best = options[0];
    let bestDelta = Infinity;
    for (const opt of options) {
      const delta = Math.min(
        Math.abs(normalized - opt.bearing),
        360 - Math.abs(normalized - opt.bearing),
      );
      if (delta < bestDelta) {
        best = opt;
        bestDelta = delta;
      }
    }
    return best.dir;
  }, []);

  const cloneRoadConfigs = useCallback(
    (configs: RoadConfig[]): RoadConfig[] =>
      configs.map((config) => ({
        ...config,
        edgeVertexIndices: config.edgeVertexIndices
          ? [...config.edgeVertexIndices] as [number, number]
          : undefined,
      })),
    [],
  );

  const createManualRoadConfigs = useCallback((): RoadConfig[] => [
    {
      id: String(Date.now()),
      width: 6,
      direction: 'south',
      customWidth: '',
      source: 'manual',
      reviewStatus: 'confirmed',
    },
  ], []);

  const handleLoadDemo = useCallback(() => {
    const demoSite: SiteBoundary = {
      area: DEMO_SITE.area,
      vertices: DEMO_SITE.vertices.map((v) => ({ ...v })),
    };
    const demoRoads: Road[] = DEMO_ROADS.map((r) => ({
      ...r,
      edgeStart: { ...r.edgeStart },
      edgeEnd: { ...r.edgeEnd },
    }));
    const demoZoning: ZoningData = {
      ...DEMO_ZONING,
      heightDistrict: { ...DEMO_ZONING.heightDistrict },
      shadowRegulation: DEMO_ZONING.shadowRegulation ? { ...DEMO_ZONING.shadowRegulation } : null,
      districtPlan: DEMO_ZONING.districtPlan ? { ...DEMO_ZONING.districtPlan } : null,
    };

    const demoWidth = Math.abs(demoSite.vertices[1].x - demoSite.vertices[0].x);
    const demoDepth = Math.abs(demoSite.vertices[2].y - demoSite.vertices[1].y);
    setSiteMode('rect');
    setSiteWidth(String(demoWidth));
    setSiteDepth(String(demoDepth));

    const demoConfigs: RoadConfig[] = demoRoads.map((road, i) => ({
      id: String(i + 1),
      width: road.width,
      direction: bearingToDirection(road.bearing),
      customWidth: '',
      source: 'demo',
      reviewStatus: 'confirmed',
      frontSetback: road.frontSetback,
      oppositeSideSetback: road.oppositeSideSetback,
      oppositeOpenSpace: road.oppositeOpenSpace,
      oppositeOpenSpaceKind: road.oppositeOpenSpaceKind,
      slopeWidthOverride: road.slopeWidthOverride,
      siteHeightAboveRoad: road.siteHeightAboveRoad,
      enableTwoA35m: road.enableTwoA35m,
    }));

    onRoadConfigsChange(
      demoConfigs.length > 0
        ? demoConfigs
        : [{
            id: '1',
            width: 6,
            direction: 'south',
            customWidth: '',
            source: 'demo',
            reviewStatus: 'confirmed',
          }],
    );

    onDistrictChange(demoZoning.district);
    onCoverageChange(String(Math.round(demoZoning.coverageRatio * 100)));
    onFarChange(String(Math.round(demoZoning.floorAreaRatio * 100)));
    onFireDistrictChange(demoZoning.fireDistrict);
    onHeightDistrictDetected(demoZoning.heightDistrict.type);
    onCornerLotChange(demoZoning.isCornerLot);

    onSiteChange(demoSite);
    onSitePrecisionChange('reference');
    onRoadsChange(demoRoads);
    onZoningChange(demoZoning);
    onLatitudeChange(DEMO_INPUT.latitude);
    setEntryMode('manual');
    setRoadAssistSource(null);
    setRoadAssistMessage(null);
    setRoadSuggestionSnapshot(null);
    setRoadUndoSnapshot(cloneRoadConfigs(roadConfigs));
  }, [
    bearingToDirection,
    cloneRoadConfigs,
    onDistrictChange,
    onCoverageChange,
    onFarChange,
    onFireDistrictChange,
    onHeightDistrictDetected,
    onCornerLotChange,
    onLatitudeChange,
    onRoadConfigsChange,
    onRoadsChange,
    onSiteChange,
    onZoningChange,
    onSitePrecisionChange,
    roadConfigs,
  ]);

  const buildDetectedRoadConfigs = useCallback(
    (
      detectedRoads: Road[],
      source: RoadSource,
      candidates?: RoadCandidate[],
    ): RoadConfig[] => {
      if (Array.isArray(candidates) && candidates.length > 0) {
        return candidates.map((candidate, index) => ({
          id: String(index + 1),
          width: candidate.width,
          direction: candidate.direction,
          customWidth: '',
          edgeVertexIndices: candidate.edgeVertexIndices,
          source: candidate.source ?? source,
          reviewStatus:
            candidate.source === 'manual' ||
            candidate.source === 'demo' ||
            source === 'manual' ||
            source === 'demo'
              ? 'confirmed'
              : 'suggested',
          confidence: candidate.confidence,
          reasoning: candidate.reasoning,
          sourceLabel: candidate.sourceLabel,
          sourceDetail: candidate.sourceDetail,
          distance: candidate.distance,
          name: candidate.name,
          highway: candidate.highway,
          frontSetback: candidate.frontSetback,
          oppositeSideSetback: candidate.oppositeSideSetback,
          oppositeOpenSpace: candidate.oppositeOpenSpace,
          oppositeOpenSpaceKind: candidate.oppositeOpenSpaceKind,
          slopeWidthOverride: candidate.slopeWidthOverride,
          siteHeightAboveRoad: candidate.siteHeightAboveRoad,
          enableTwoA35m: candidate.enableTwoA35m,
        }));
      }

      if (detectedRoads.length === 0) {
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

      return detectedRoads.map((road, index) => ({
        id: String(index + 1),
        width: road.width,
        direction: bearingToDirection(road.bearing),
        customWidth: '',
        source,
        reviewStatus: source === 'manual' || source === 'demo' ? 'confirmed' : 'suggested',
        frontSetback: road.frontSetback,
        oppositeSideSetback: road.oppositeSideSetback,
        oppositeOpenSpace: road.oppositeOpenSpace,
        oppositeOpenSpaceKind: road.oppositeOpenSpaceKind,
        slopeWidthOverride: road.slopeWidthOverride,
        siteHeightAboveRoad: road.siteHeightAboveRoad,
        enableTwoA35m: road.enableTwoA35m,
      }));
    },
    [bearingToDirection],
  );

  const applyDetectedRoads = useCallback((
    detectedRoads: Road[],
    options?: {
      source?: RoadSource;
      candidates?: RoadCandidate[];
      message?: string | null;
    },
  ) => {
    const source = options?.source ?? 'manual';
    const nextConfigs = buildDetectedRoadConfigs(detectedRoads, source, options?.candidates);
    setRoadUndoSnapshot(cloneRoadConfigs(roadConfigs));
    onRoadConfigsChange(nextConfigs);
    onRoadsChange(detectedRoads);
    onCornerLotChange(detectedRoads.length >= 2);
    setRoadSuggestionSnapshot(
      source === 'api' || source === 'ai' ? cloneRoadConfigs(nextConfigs) : null,
    );
    setRoadAssistSource(
      nextConfigs.some((config) => (config.reviewStatus ?? 'confirmed') === 'suggested') &&
        source !== 'manual' &&
        source !== 'demo'
        ? source
        : null,
    );
    setRoadAssistMessage(options?.message ?? null);
    if (source !== 'manual') setEntryMode(source === 'api' ? 'address' : 'file');
  }, [buildDetectedRoadConfigs, cloneRoadConfigs, onCornerLotChange, onRoadConfigsChange, onRoadsChange, roadConfigs]);

  const buildRoadsForConfigs = useCallback((configs: RoadConfig[]): Road[] => {
    if (effectiveSiteMode === 'rect') {
      const w = parseFloat(siteWidth);
      const d = parseFloat(siteDepth);
      if (Number.isNaN(w) || Number.isNaN(d) || w <= 0 || d <= 0) return [];
      return configs.map((rc) => buildRoad(w, d, rc.width, rc.direction, rc));
    }

    if (!site || site.vertices.length < 3) return [];
    return buildRoadsFromPolygonConfigs(site.vertices, configs);
  }, [effectiveSiteMode, site, siteWidth, siteDepth]);

  const rebuildRoads = useCallback((configs: RoadConfig[]) => {
    const nextRoads = buildRoadsForConfigs(configs);
    if (nextRoads.length > 0 || configs.length === 0) {
      onRoadsChange(nextRoads);
    }
  }, [buildRoadsForConfigs, onRoadsChange]);

  const tryBuildScene = useCallback(() => {
    if (effectiveSiteMode === 'rect') {
      const w = parseFloat(siteWidth);
      const d = parseFloat(siteDepth);
      if (!Number.isNaN(w) && !Number.isNaN(d) && w > 0 && d > 0) {
        onSiteChange(buildRectSite(w, d));
      }
    }

    rebuildRoads(roadConfigs);
    if (!selectedDistrict) return;

    const covParsed = coverageOverride ? parseFloat(coverageOverride) / 100 : undefined;
    const farParsed = farOverride ? parseFloat(farOverride) / 100 : undefined;

    onZoningChange(buildZoningData(selectedDistrict, {
      coverageRatio: covParsed,
      floorAreaRatio: farParsed,
      fireDistrict,
      heightDistrict: { type: heightDistrictType },
      isCornerLot,
    }));
  }, [
    coverageOverride,
    farOverride,
    fireDistrict,
    heightDistrictType,
    isCornerLot,
    onSiteChange,
    onZoningChange,
    rebuildRoads,
    roadConfigs,
    selectedDistrict,
    siteDepth,
    effectiveSiteMode,
    siteWidth,
  ]);

  const debouncedUpdate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(tryBuildScene, 80);
  }, [tryBuildScene]);

  const handleSiteWidth = (value: string) => {
    setSiteWidth(value);
    debouncedUpdate();
  };

  const handleSiteDepth = (value: string) => {
    setSiteDepth(value);
    debouncedUpdate();
  };

  const handleRoadConfigsChange = (configs: RoadConfig[]) => {
    setRoadUndoSnapshot(cloneRoadConfigs(roadConfigs));
    onRoadConfigsChange(configs);
    onCornerLotChange(configs.length >= 2);
    if (configs.every((config) => (config.reviewStatus ?? 'confirmed') === 'confirmed')) {
      setRoadAssistSource(null);
      setRoadAssistMessage(null);
    } else {
      const suggestedSource =
        configs.find((config) => (config.reviewStatus ?? 'confirmed') === 'suggested')?.source ?? null;
      setRoadAssistSource(suggestedSource === 'api' || suggestedSource === 'ai' ? suggestedSource : null);
    }
    rebuildRoads(configs);
  };

  const handleUndoRoadConfigs = useCallback(() => {
    if (!roadUndoSnapshot) return;
    const snapshot = cloneRoadConfigs(roadUndoSnapshot);
    onRoadConfigsChange(snapshot);
    onCornerLotChange(snapshot.length >= 2);
    rebuildRoads(snapshot);
    if (snapshot.every((config) => (config.reviewStatus ?? 'confirmed') === 'confirmed')) {
      setRoadAssistSource(null);
      setRoadAssistMessage(null);
    } else {
      const suggestedSource =
        snapshot.find((config) => (config.reviewStatus ?? 'confirmed') === 'suggested')?.source ?? null;
      setRoadAssistSource(suggestedSource === 'api' || suggestedSource === 'ai' ? suggestedSource : null);
      setRoadAssistMessage('1つ前の道路設定に戻しました。');
    }
    setRoadUndoSnapshot(null);
  }, [cloneRoadConfigs, onCornerLotChange, onRoadConfigsChange, rebuildRoads, roadUndoSnapshot]);

  const handleRestoreSuggestedRoads = useCallback(() => {
    if (!roadSuggestionSnapshot) return;
    const snapshot = cloneRoadConfigs(roadSuggestionSnapshot);
    setRoadUndoSnapshot(cloneRoadConfigs(roadConfigs));
    onRoadConfigsChange(snapshot);
    onCornerLotChange(snapshot.length >= 2);
    rebuildRoads(snapshot);
    const suggestedSource =
      snapshot.find((config) => (config.reviewStatus ?? 'confirmed') === 'suggested')?.source ?? null;
    setRoadAssistSource(suggestedSource === 'api' || suggestedSource === 'ai' ? suggestedSource : null);
    setRoadAssistMessage('自動取得した道路候補に戻しました。');
  }, [cloneRoadConfigs, onCornerLotChange, onRoadConfigsChange, rebuildRoads, roadConfigs, roadSuggestionSnapshot]);

  const handleResetRoads = useCallback(() => {
    const nextConfigs = createManualRoadConfigs();
    setRoadUndoSnapshot(cloneRoadConfigs(roadConfigs));
    onRoadConfigsChange(nextConfigs);
    onCornerLotChange(false);
    rebuildRoads(nextConfigs);
    setRoadAssistSource(null);
    setRoadAssistMessage(null);
  }, [cloneRoadConfigs, createManualRoadConfigs, onCornerLotChange, onRoadConfigsChange, rebuildRoads, roadConfigs]);

  useEffect(() => {
    if (effectiveSiteMode !== 'polygon' || !site || site.vertices.length < 3) return;
    onRoadsChange(buildRoadsFromPolygonConfigs(site.vertices, roadConfigs));
  }, [effectiveSiteMode, site, roadConfigs, onRoadsChange]);

  return (
    <div className="space-y-4 p-4">
      {site ? (
        <div className="grid grid-cols-4 gap-2">
          <div className="ui-surface-soft px-3 py-3">
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground">敷地</p>
            <p className="mt-2 font-display text-lg font-semibold text-foreground">
              {site.area.toFixed(0)}
              <span className="ml-1 text-xs font-normal text-muted-foreground">m²</span>
            </p>
          </div>
          <div className="ui-surface-soft px-3 py-3">
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground">形状</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {effectiveSiteMode === 'rect' ? '矩形' : '多角形'}
            </p>
          </div>
          <div className="ui-surface-soft px-3 py-3">
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground">道路</p>
            <p className="mt-2 text-sm font-semibold text-foreground">{roadConfigs.length} 面</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {roadConfigs.every((config) => (config.reviewStatus ?? 'confirmed') === 'confirmed')
                ? '確認済み'
                : '確認待ちあり'}
            </p>
          </div>
          <div className="ui-surface-soft px-3 py-3">
            <p className="text-[10px] tracking-[0.14em] text-muted-foreground">精度</p>
            <p className="mt-2 text-sm font-semibold text-foreground">{getSitePrecisionLabel(sitePrecision)}</p>
            <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
              {getSitePrecisionHint(sitePrecision)}
            </p>
          </div>
        </div>
      ) : null}

      <SectionCard
        eyebrow="Start"
        title={site ? '入力方法を切り替える' : '最初の入力方法を選ぶ'}
        description="入口は一つ選べば十分です。あとからいつでも別の方法へ切り替えられます。"
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'address', label: '住所から', description: '候補を探す' },
            { key: 'file', label: '図面から', description: 'AIで読む' },
            { key: 'manual', label: '手入力', description: 'ざっくり作る' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setEntryMode(option.key as 'address' | 'file' | 'manual')}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left transition-colors',
                entryMode === option.key
                  ? 'border-primary/30 bg-primary/10 text-foreground shadow-sm'
                  : 'border-border/80 bg-white/72 text-muted-foreground',
              )}
            >
              <p className="text-[11px] font-semibold">{option.label}</p>
              <p className="mt-1 text-[10px] leading-4">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-white/72 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-foreground">デモモデルですぐ確認</p>
              <p className="mt-1 text-[10px] leading-5 text-muted-foreground">
                まず操作感だけ見たい場合は、デモデータでそのまま始められます。
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleLoadDemo} className="shrink-0">
              デモを表示
            </Button>
          </div>
        </div>

        {entryMode === 'address' ? (
          <AddressSearch
            onSiteChange={onSiteChange}
            onSitePrecisionChange={onSitePrecisionChange}
            onRoadsChange={applyDetectedRoads}
            onZoningChange={onZoningChange}
            onLatitudeChange={onLatitudeChange}
            onDistrictDetected={onDistrictChange}
            onCoverageDetected={onCoverageChange}
            onFarDetected={onFarChange}
            onFireDetected={onFireDistrictChange}
            onHeightDetected={onHeightDistrictDetected}
          />
        ) : null}

        {entryMode === 'file' ? (
          <FileUpload
            onSiteChange={onSiteChange}
            onSitePrecisionChange={onSitePrecisionChange}
            onRoadsChange={applyDetectedRoads}
            onZoningChange={onZoningChange}
            onLatitudeChange={onLatitudeChange}
            roadWidth={roadConfigs[0]?.width ?? 6}
            selectedDistrict={selectedDistrict}
            onSiteWidthDetected={setSiteWidth}
            onSiteDepthDetected={setSiteDepth}
            onDistrictDetected={onDistrictChange}
            onCoverageDetected={onCoverageChange}
            onFarDetected={onFarChange}
            onFireDetected={onFireDistrictChange}
          />
        ) : null}

        {entryMode === 'manual' ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-white/72 px-3 py-3">
              <p className="text-[11px] font-medium text-foreground">
                手入力は外形だけ先に置けば十分です。道路と法規はあとからいくらでも調整できます。
              </p>
            </div>
            <SiteEditor
              site={site}
              onSiteChange={(nextSite) => {
                onSiteChange(nextSite);
                onSitePrecisionChange('reference');
              }}
              siteWidth={siteWidth}
              siteDepth={siteDepth}
              onSiteWidthChange={handleSiteWidth}
              onSiteDepthChange={handleSiteDepth}
              siteMode={effectiveSiteMode}
              onSiteModeChange={setSiteMode}
            />
          </div>
        ) : null}
      </SectionCard>

      {!site ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 shadow-sm">
          <p className="text-[11px] text-amber-950">
            まだ敷地は未確定です。まずは上の入口を一つ使って、外形だけ置いてください。細かい調整はあとでやり直せます。
          </p>
        </div>
      ) : null}

      {site && entryMode !== 'manual' ? (
        <SectionCard
          eyebrow="Adjust"
          title="敷地形状を微調整"
          description="自動取得のあとに、寸法だけ手で直したいときはここで調整できます。"
        >
          <SiteEditor
            site={site}
            onSiteChange={(nextSite) => {
              onSiteChange(nextSite);
              onSitePrecisionChange('reference');
            }}
            siteWidth={siteWidth}
            siteDepth={siteDepth}
            onSiteWidthChange={handleSiteWidth}
            onSiteDepthChange={handleSiteDepth}
            siteMode={effectiveSiteMode}
            onSiteModeChange={setSiteMode}
          />
        </SectionCard>
      ) : null}

      {site ? (
        <SectionCard
          eyebrow="Road"
          title="接道条件を確認する"
          description="自動候補のままでも進められますが、一度は幅員と接する辺を見ておくと後から迷いません。"
        >
          {roadAssistSource ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3">
              <p className="text-[11px] font-medium text-amber-950">
                {roadAssistSource === 'api' ? 'API' : 'AI'} が道路候補を提案しました。
              </p>
              <p className="mt-1 text-[10px] leading-5 text-amber-800">
                PDF や画像からの読取りでは接道辺を外すことがあるので、最後に幅員と向きを確認してください。
              </p>
              {roadAssistMessage ? (
                <p className="mt-2 text-[10px] leading-5 text-amber-900">{roadAssistMessage}</p>
              ) : null}
            </div>
          ) : null}
          <RoadEditor
            roadConfigs={roadConfigs}
            onRoadConfigsChange={handleRoadConfigsChange}
            onCornerLotChange={onCornerLotChange}
            site={site}
            siteMode={effectiveSiteMode}
            canUndo={roadUndoSnapshot !== null}
            onUndo={handleUndoRoadConfigs}
            canRestoreSuggestions={roadSuggestionSnapshot !== null}
            onRestoreSuggestions={handleRestoreSuggestedRoads}
            onResetRoads={handleResetRoads}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
