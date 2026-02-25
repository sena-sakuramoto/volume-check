'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { SiteBoundary, Road, ZoningData, VolumeResult } from '@/engine/types';
import { generateEnvelope, getShadowMaskAtTime } from '@/engine';
import { SiteInputPanel } from '@/components/ui/SiteInputPanel';
import { RegulationPanel } from '@/components/ui/RegulationPanel';
import { LayerControls } from '@/components/ui/LayerControls';
import { FloorEditor } from '@/components/ui/FloorEditor';
import { AiChat } from '@/components/chat/AiChat';
import { PrintReport } from '@/components/ui/PrintReport';
import { DEMO_SITE, DEMO_ROADS, DEMO_ZONING } from '@/lib/demo-data';
import { loadProject, saveProject } from '@/lib/project-storage';

const Scene = dynamic(
  () => import('@/components/three/Scene').then((m) => ({ default: m.Scene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        3Dビューを読み込み中...
      </div>
    ),
  },
);

const DEFAULT_LAYERS: Record<string, boolean> = {
  road: true,
  adjacent: true,
  north: true,
  absoluteHeight: true,
  shadow: true,
  reverseShadowContours: true,
  reverseShadowHeightmap: false,
  shadowMeasurementLines: true,
  shadowHeatmap: false,
  shadowTimeShadow: false,
  floorPlates: true,
};

type MobileTab = 'input' | '3d' | 'result' | 'ai';

const TAB_DEFS: { key: MobileTab; label: string }[] = [
  { key: 'input', label: '入力' },
  { key: '3d', label: '3D' },
  { key: 'result', label: '結果' },
  { key: 'ai', label: 'AI' },
];

export default function ProjectPage() {
  const [site, setSite] = useState<SiteBoundary | null>(null);
  const [roads, setRoads] = useState<Road[]>([]);
  const [zoning, setZoning] = useState<ZoningData | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>(DEFAULT_LAYERS);
  const [isLoading] = useState(false);
  const [latitude, setLatitude] = useState(35.68);
  const [floorHeights, setFloorHeights] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<MobileTab>('input');
  const [showLayers, setShowLayers] = useState(false);
  const [shadowTimeValue, setShadowTimeValue] = useState(120); // slider value: 0=8:00, 480=16:00 (minutes from 8:00)

  // Load saved project on mount
  useEffect(() => {
    const saved = loadProject();
    if (saved) {
      setSite(saved.site);
      setRoads(saved.roads);
      setZoning(saved.zoning);
      setLatitude(saved.latitude);
      if (saved.floorHeights.length > 0) setFloorHeights(saved.floorHeights);
    }
  }, []);

  // Auto-save project when inputs change
  useEffect(() => {
    if (!site || !zoning || roads.length === 0) return;
    saveProject({ site, roads, zoning, latitude, floorHeights, savedAt: '' });
  }, [site, roads, zoning, latitude, floorHeights]);

  const [calcError, setCalcError] = useState<string | null>(null);

  // Calculate volume result whenever inputs change
  const volumeResult: VolumeResult | null = useMemo(() => {
    if (!site || !zoning || roads.length === 0) {
      setCalcError(null);
      return null;
    }
    try {
      setCalcError(null);
      return generateEnvelope({
        site,
        zoning,
        roads,
        latitude,
        floorHeights: floorHeights.length > 0 ? floorHeights : undefined,
      });
    } catch (e) {
      setCalcError(e instanceof Error ? e.message : '計算エラーが発生しました');
      return null;
    }
  }, [site, zoning, roads, latitude, floorHeights]);

  // Derive effective floor heights from maxFloors
  const maxFloors = volumeResult?.maxFloors ?? 0;
  const effectiveFloorHeights = useMemo(() => {
    if (maxFloors <= 0) return [];
    if (floorHeights.length === maxFloors) return floorHeights;
    // Preserve existing values, fill missing with 3.0
    const result: number[] = [];
    for (let i = 0; i < maxFloors; i++) {
      result.push(i < floorHeights.length ? floorHeights[i] : 3.0);
    }
    return result;
  }, [maxFloors, floorHeights]);

  // Shadow time from slider value
  const shadowTime = useMemo(() => {
    const totalMinutes = 8 * 60 + shadowTimeValue;
    return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
  }, [shadowTimeValue]);

  // Shadow mask for time-specific display
  const shadowMask = useMemo(() => {
    if (!volumeResult?.heightFieldData || !site || !zoning?.shadowRegulation) return null;
    if (!layers.shadowTimeShadow) return null;

    try {
      const maskResult = getShadowMaskAtTime(
        volumeResult.heightFieldData,
        site.vertices,
        zoning.shadowRegulation.measurementHeight,
        latitude,
        0, // northRotation - will be computed internally
        shadowTime.hour,
        shadowTime.minute,
      );
      return maskResult.mask;
    } catch {
      return null;
    }
  }, [volumeResult, site, zoning, latitude, layers.shadowTimeShadow, shadowTime]);

  const handleLoadDemo = useCallback(() => {
    setSite(DEMO_SITE);
    setRoads(DEMO_ROADS);
    setZoning(DEMO_ZONING);
  }, []);

  const handleToggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleTabChange = useCallback((tab: MobileTab) => {
    setActiveTab(tab);
    // Close layer dropdown when switching tabs
    setShowLayers(false);
  }, []);

  // Build the typed layers object for Scene
  const typedLayers = {
    road: layers.road ?? false,
    adjacent: layers.adjacent ?? false,
    north: layers.north ?? false,
    absoluteHeight: layers.absoluteHeight ?? false,
    shadow: layers.shadow ?? false,
    floorPlates: layers.floorPlates ?? true,
    reverseShadowContours: layers.reverseShadowContours ?? true,
    reverseShadowHeightmap: layers.reverseShadowHeightmap ?? false,
    shadowHeatmap: layers.shadowHeatmap ?? false,
    shadowTimeShadow: layers.shadowTimeShadow ?? false,
    shadowMeasurementLines: layers.shadowMeasurementLines ?? true,
  };

  // Check if bottom sheet should be visible (mobile only)
  const isSheetOpen = activeTab !== '3d';

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 no-print">
      {/* Header */}
      <header className="flex items-center h-11 px-4 border-b border-gray-800 shrink-0">
        <h1 className="text-base font-bold tracking-tight text-white">
          VolumeCheck
        </h1>
        <span className="ml-1.5 rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400 uppercase">
          beta
        </span>
      </header>

      {/* ============================================================ */}
      {/* DESKTOP LAYOUT (md and above) */}
      {/* ============================================================ */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 shrink-0 border-r border-gray-800 overflow-y-auto">
          <SiteInputPanel
            onSiteChange={setSite}
            onRoadsChange={setRoads}
            onZoningChange={setZoning}
            onLatitudeChange={setLatitude}
            onLoadDemo={handleLoadDemo}
            site={site}
            isLoading={isLoading}
          />
          <div className="border-t border-gray-800" />
          <FloorEditor
            maxFloors={volumeResult?.maxFloors ?? 0}
            maxHeight={volumeResult?.maxHeight ?? 0}
            floorHeights={effectiveFloorHeights}
            onFloorHeightsChange={setFloorHeights}
          />
          <div className="border-t border-gray-800" />
          <LayerControls layers={layers} onToggle={handleToggleLayer} />
          {/* Shadow time slider */}
          {layers.shadowTimeShadow && (
            <div className="border-t border-gray-800 p-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                日影時刻
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-12">
                  {shadowTime.hour}:{String(shadowTime.minute).padStart(2, '0')}
                </span>
                <input
                  type="range"
                  min={0}
                  max={480}
                  step={10}
                  value={shadowTimeValue}
                  onChange={(e) => setShadowTimeValue(Number(e.target.value))}
                  className="flex-1 h-1.5 accent-blue-500"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                <span>8:00</span>
                <span>12:00</span>
                <span>16:00</span>
              </div>
            </div>
          )}
        </aside>

        {/* Center: 3D Scene */}
        <main className="flex-1 relative">
          {calcError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-lg bg-red-900/90 border border-red-700 px-4 py-2 text-xs text-red-200 shadow-lg">
              {calcError}
            </div>
          )}
          <Scene
            site={site}
            roads={roads}
            zoning={zoning}
            volumeResult={volumeResult}
            floorHeights={effectiveFloorHeights}
            layers={typedLayers}
            shadowTime={layers.shadowTimeShadow ? shadowTime : null}
            shadowMask={shadowMask}
          />
        </main>

        {/* Right Sidebar */}
        <aside className="w-72 shrink-0 border-l border-gray-800 overflow-y-auto">
          <RegulationPanel
            zoning={zoning}
            result={volumeResult}
            site={site}
            roads={roads}
            floorHeights={effectiveFloorHeights}
            latitude={latitude}
          />
        </aside>
      </div>

      {/* Desktop: Bottom Bar AI Chat */}
      <div className="hidden md:block shrink-0 border-t border-gray-800">
        <AiChat
          zoning={zoning}
          result={volumeResult}
          siteArea={site?.area ?? null}
        />
      </div>

      {/* ============================================================ */}
      {/* MOBILE LAYOUT (below md) */}
      {/* ============================================================ */}
      <div className="flex md:hidden flex-1 relative overflow-hidden">
        {/* Full-screen 3D view as background */}
        <div className="absolute inset-0">
          <Scene
            site={site}
            roads={roads}
            zoning={zoning}
            volumeResult={volumeResult}
            floorHeights={effectiveFloorHeights}
            layers={typedLayers}
            shadowTime={layers.shadowTimeShadow ? shadowTime : null}
            shadowMask={shadowMask}
          />
        </div>

        {/* Floating layer control button (top-right) */}
        <button
          onClick={() => setShowLayers((prev) => !prev)}
          className="absolute top-3 right-3 z-30 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800/90 transition-colors"
        >
          レイヤー
        </button>

        {/* Layer controls dropdown (mobile) */}
        {showLayers && (
          <div className="absolute top-12 right-3 z-30 rounded-lg bg-gray-900/95 backdrop-blur-sm border border-gray-700 shadow-xl">
            <LayerControls layers={layers} onToggle={handleToggleLayer} />
          </div>
        )}

        {/* Bottom sheet */}
        {isSheetOpen && (
          <div className="absolute bottom-12 left-0 right-0 z-20 max-h-[60vh] overflow-y-auto bg-gray-950 border-t border-gray-800 rounded-t-xl pb-[env(safe-area-inset-bottom)]">
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 sticky top-0 bg-gray-950 z-10">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Tab content */}
            {activeTab === 'input' && (
              <div>
                <SiteInputPanel
                  onSiteChange={setSite}
                  onRoadsChange={setRoads}
                  onZoningChange={setZoning}
                  onLatitudeChange={setLatitude}
                  onLoadDemo={handleLoadDemo}
                  site={site}
                  isLoading={isLoading}
                />
                <div className="border-t border-gray-800" />
                <FloorEditor
                  maxFloors={volumeResult?.maxFloors ?? 0}
                  maxHeight={volumeResult?.maxHeight ?? 0}
                  floorHeights={effectiveFloorHeights}
                  onFloorHeightsChange={setFloorHeights}
                />
              </div>
            )}

            {activeTab === 'result' && (
              <RegulationPanel
                zoning={zoning}
                result={volumeResult}
                site={site}
                roads={roads}
                floorHeights={effectiveFloorHeights}
                latitude={latitude}
              />
            )}

            {activeTab === 'ai' && (
              <div className="p-3">
                <AiChat
                  zoning={zoning}
                  result={volumeResult}
                  siteArea={site?.area ?? null}
                />
              </div>
            )}
          </div>
        )}

        {/* Bottom tab bar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 flex h-12 bg-gray-900 border-t border-gray-700">
          {TAB_DEFS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isActive
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <span className="text-[10px] leading-none font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Print-only report */}
      <PrintReport zoning={zoning} result={volumeResult} siteArea={site?.area ?? null} floorHeights={effectiveFloorHeights} latitude={latitude} />
    </div>
  );
}
