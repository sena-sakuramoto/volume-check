'use client';

import { useState, useCallback, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import type {
  SiteBoundary,
  Road,
  ZoningData,
  ZoningDistrict,
  FireDistrict,
  HeightDistrict,
} from '@/engine/types';
import { getZoningDefaults } from '@/engine';
import { PolygonSiteInput } from './PolygonSiteInput';

/* ------------------------------------------------------------------ */
/*  Analyze-site API response type                                     */
/* ------------------------------------------------------------------ */

interface AnalyzeSiteResponse {
  type?: string;
  site?: {
    vertices?: { x: number; y: number }[];
    area?: number;
    frontageWidth?: number;
    depth?: number;
  };
  roads?: {
    direction?: string;
    width?: number;
  }[];
  zoning?: {
    district?: string | null;
    coverageRatio?: number | null;
    floorAreaRatio?: number | null;
    fireDistrict?: string | null;
  };
  confidence?: string;
  notes?: string;
  error?: string;
}

type UploadStatus =
  | { state: 'idle' }
  | { state: 'uploading' }
  | { state: 'success'; notes: string }
  | { state: 'error'; message: string };

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface SiteInputPanelProps {
  onSiteChange: (site: SiteBoundary) => void;
  onRoadsChange: (roads: Road[]) => void;
  onZoningChange: (zoning: ZoningData) => void;
  onLatitudeChange: (lat: number) => void;
  onLoadDemo: () => void;
  site: SiteBoundary | null;
  isLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROAD_WIDTH_PRESETS = [4, 6, 8];

type RoadDirection = 'south' | 'north' | 'east' | 'west';

const ROAD_DIRECTION_OPTIONS: { key: RoadDirection; label: string; bearing: number }[] = [
  { key: 'south', label: '南', bearing: 180 },
  { key: 'east', label: '東', bearing: 90 },
  { key: 'west', label: '西', bearing: 270 },
  { key: 'north', label: '北', bearing: 0 },
];

interface DistrictGroup {
  label: string;
  bgClass: string;
  activeBgClass: string;
  districts: ZoningDistrict[];
}

const DISTRICT_GROUPS: DistrictGroup[] = [
  {
    label: '住居系',
    bgClass: 'bg-blue-900/30 text-blue-200 hover:bg-blue-800/50',
    activeBgClass: 'bg-blue-600 text-white',
    districts: [
      '第一種低層住居専用地域',
      '第二種低層住居専用地域',
      '第一種中高層住居専用地域',
      '第二種中高層住居専用地域',
      '第一種住居地域',
      '第二種住居地域',
      '準住居地域',
      '田園住居地域',
    ],
  },
  {
    label: '商業系',
    bgClass: 'bg-orange-900/30 text-orange-200 hover:bg-orange-800/50',
    activeBgClass: 'bg-orange-600 text-white',
    districts: ['近隣商業地域', '商業地域'],
  },
  {
    label: '工業系',
    bgClass: 'bg-gray-700/50 text-gray-200 hover:bg-gray-600/50',
    activeBgClass: 'bg-gray-500 text-white',
    districts: ['準工業地域', '工業地域', '工業専用地域'],
  },
];

const ALL_DISTRICTS: ZoningDistrict[] = DISTRICT_GROUPS.flatMap((g) => g.districts);

/* ------------------------------------------------------------------ */
/*  Address search state machine                                       */
/* ------------------------------------------------------------------ */

type SearchStatus =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'geocoded'; address: string; lat: number; lng: number }
  | { state: 'zoning-loading'; address: string; lat: number; lng: number }
  | { state: 'success'; address: string; district: ZoningDistrict }
  | { state: 'zoning-not-found'; address: string }
  | { state: 'error'; message: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortenDistrict(d: ZoningDistrict): string {
  return d.replace('専用地域', '専用').replace('地域', '');
}

function buildRectSite(width: number, depth: number): SiteBoundary {
  return {
    vertices: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: depth },
      { x: 0, y: depth },
    ],
    area: width * depth,
  };
}

function buildRoad(
  width: number,
  depth: number,
  roadWidth: number,
  direction: RoadDirection,
): Road {
  const dirInfo = ROAD_DIRECTION_OPTIONS.find((d) => d.key === direction)!;
  let edgeStart: { x: number; y: number };
  let edgeEnd: { x: number; y: number };

  switch (direction) {
    case 'south':
      edgeStart = { x: 0, y: 0 };
      edgeEnd = { x: width, y: 0 };
      break;
    case 'north':
      edgeStart = { x: width, y: depth };
      edgeEnd = { x: 0, y: depth };
      break;
    case 'east':
      edgeStart = { x: width, y: 0 };
      edgeEnd = { x: width, y: depth };
      break;
    case 'west':
      edgeStart = { x: 0, y: depth };
      edgeEnd = { x: 0, y: 0 };
      break;
  }

  return {
    edgeStart,
    edgeEnd,
    width: roadWidth,
    centerOffset: roadWidth / 2,
    bearing: dirInfo.bearing,
  };
}

function buildZoningData(
  district: ZoningDistrict,
  overrides?: {
    coverageRatio?: number;
    floorAreaRatio?: number;
    fireDistrict?: FireDistrict;
    heightDistrict?: HeightDistrict;
    isCornerLot?: boolean;
  },
): ZoningData {
  const defaults = getZoningDefaults(district);
  return {
    district,
    fireDistrict: overrides?.fireDistrict ?? '指定なし',
    heightDistrict: overrides?.heightDistrict ?? { type: '指定なし' },
    coverageRatio: overrides?.coverageRatio ?? defaults.defaultCoverageRatio,
    floorAreaRatio: overrides?.floorAreaRatio ?? defaults.defaultFloorAreaRatio,
    absoluteHeightLimit: defaults.absoluteHeightLimit,
    wallSetback: defaults.wallSetback,
    shadowRegulation: defaults.shadowRegulation,
    isCornerLot: overrides?.isCornerLot ?? false,
  };
}

function normalizeRatio(value: number): number {
  if (value > 1) return value / 100;
  return value;
}

function matchDistrict(raw: string): ZoningDistrict | null {
  if (ALL_DISTRICTS.includes(raw as ZoningDistrict)) {
    return raw as ZoningDistrict;
  }
  for (const d of ALL_DISTRICTS) {
    if (raw.includes(d) || d.includes(raw)) {
      return d;
    }
  }
  return null;
}

function matchFireDistrict(raw: string): FireDistrict {
  if (raw.includes('準防火')) return '準防火地域';
  if (raw.includes('防火')) return '防火地域';
  return '指定なし';
}

/* ------------------------------------------------------------------ */
/*  Spinner SVG                                                        */
/* ------------------------------------------------------------------ */

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width="14"
      height="14"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SiteInputPanel({
  onSiteChange,
  onRoadsChange,
  onZoningChange,
  onLatitudeChange,
  onLoadDemo,
  site,
  isLoading: externalLoading,
}: SiteInputPanelProps) {
  const [address, setAddress] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({ state: 'idle' });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ state: 'idle' });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [siteWidth, setSiteWidth] = useState('');
  const [siteDepth, setSiteDepth] = useState('');

  const [selectedDistrict, setSelectedDistrict] = useState<ZoningDistrict | null>(null);
  const [coverageOverride, setCoverageOverride] = useState('');
  const [farOverride, setFarOverride] = useState('');
  const [fireDistrict, setFireDistrict] = useState<FireDistrict>('指定なし');

  const [heightDistrictType, setHeightDistrictType] = useState<HeightDistrict['type']>('指定なし');
  const [isCornerLot, setIsCornerLot] = useState(false);
  const [siteMode, setSiteMode] = useState<'rect' | 'polygon'>('rect');

  // Multiple roads support
  interface RoadConfig {
    id: string;
    width: number;
    direction: RoadDirection;
    customWidth: string;
  }
  const [roadConfigs, setRoadConfigs] = useState<RoadConfig[]>([
    { id: '1', width: 6, direction: 'south', customWidth: '' },
  ]);

  // Keep legacy single-road state for compatibility with upload handler
  const roadWidth = roadConfigs[0]?.width ?? 6;
  const roadDirection = roadConfigs[0]?.direction ?? 'south';
  const customRoadWidth = roadConfigs[0]?.customWidth ?? '';
  const setRoadWidth = (w: number) => setRoadConfigs(prev => prev.map((r, i) => i === 0 ? { ...r, width: w } : r));
  const setRoadDirection = (d: RoadDirection) => setRoadConfigs(prev => prev.map((r, i) => i === 0 ? { ...r, direction: d } : r));
  const setCustomRoadWidth = (v: string) => setRoadConfigs(prev => prev.map((r, i) => i === 0 ? { ...r, customWidth: v } : r));

  const latLngRef = useRef<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearching =
    searchStatus.state === 'loading' || searchStatus.state === 'zoning-loading';

  const updateScene = useCallback(
    (
      w: number,
      d: number,
      dist: ZoningDistrict,
      rw: number,
      rDir: RoadDirection,
      covOvr?: number,
      farOvr?: number,
      fireDist?: FireDistrict,
      hdType?: HeightDistrict['type'],
      cornerLot?: boolean,
      allRoads?: RoadConfig[],
    ) => {
      if (siteMode === 'rect') {
        const newSite = buildRectSite(w, d);
        onSiteChange(newSite);
      }
      const effectiveHD = hdType ?? heightDistrictType;
      const effectiveCorner = cornerLot ?? isCornerLot;
      onZoningChange(
        buildZoningData(dist, {
          coverageRatio: covOvr,
          floorAreaRatio: farOvr,
          fireDistrict: fireDist,
          heightDistrict: { type: effectiveHD },
          isCornerLot: effectiveCorner,
        }),
      );
      // Build roads from all configs
      const configs = allRoads ?? roadConfigs;
      const roads = configs.map((rc) => buildRoad(w, d, rc.width, rc.direction));
      onRoadsChange(roads);
    },
    [onSiteChange, onZoningChange, onRoadsChange, siteMode, heightDistrictType, isCornerLot, roadConfigs],
  );

  const tryUpdate = useCallback(
    (overrides?: {
      w?: number;
      d?: number;
      dist?: ZoningDistrict;
      rw?: number;
      rDir?: RoadDirection;
      covOvr?: number;
      farOvr?: number;
      fireDist?: FireDistrict;
      hdType?: HeightDistrict['type'];
      cornerLot?: boolean;
      allRoads?: RoadConfig[];
    }) => {
      const w = overrides?.w ?? parseFloat(siteWidth);
      const d = overrides?.d ?? parseFloat(siteDepth);
      const dist = overrides?.dist ?? selectedDistrict;
      const rw = overrides?.rw ?? roadWidth;
      const rDir = overrides?.rDir ?? roadDirection;

      if (!dist || isNaN(w) || isNaN(d) || w <= 0 || d <= 0) return;

      const covParsed =
        overrides?.covOvr ??
        (coverageOverride ? parseFloat(coverageOverride) / 100 : undefined);
      const farParsed =
        overrides?.farOvr ??
        (farOverride ? parseFloat(farOverride) / 100 : undefined);
      const fireDist = overrides?.fireDist ?? fireDistrict;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateScene(w, d, dist, rw, rDir, covParsed, farParsed, fireDist, overrides?.hdType, overrides?.cornerLot, overrides?.allRoads);
      }, 80);
    },
    [
      siteWidth,
      siteDepth,
      selectedDistrict,
      roadWidth,
      roadDirection,
      coverageOverride,
      farOverride,
      fireDistrict,
      updateScene,
    ],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleAddressSearch = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setSearchStatus({ state: 'loading' });

    try {
      const geocodeRes = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });

      if (!geocodeRes.ok) {
        const data = await geocodeRes.json().catch(() => ({}));
        setSearchStatus({
          state: 'error',
          message: data.error || '住所が見つかりませんでした',
        });
        return;
      }

      const geocodeData: { lat: number; lng: number; address: string } =
        await geocodeRes.json();

      const { lat, lng, address: confirmedAddress } = geocodeData;

      latLngRef.current = { lat, lng };
      onLatitudeChange(lat);

      setSearchStatus({
        state: 'zoning-loading',
        address: confirmedAddress,
        lat,
        lng,
      });

      const zoningRes = await fetch('/api/zoning-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (!zoningRes.ok) {
        setSearchStatus({
          state: 'zoning-not-found',
          address: confirmedAddress,
        });
        return;
      }

      const zoningData: {
        district: string;
        coverageRatio: number;
        floorAreaRatio: number;
        fireDistrict: string;
      } = await zoningRes.json();

      const matchedDistrict = matchDistrict(zoningData.district);

      if (!matchedDistrict) {
        setSearchStatus({
          state: 'zoning-not-found',
          address: confirmedAddress,
        });
        return;
      }

      const normalizedCoverage = normalizeRatio(zoningData.coverageRatio);
      const normalizedFAR = normalizeRatio(zoningData.floorAreaRatio);
      const matchedFire = matchFireDistrict(zoningData.fireDistrict);

      setSelectedDistrict(matchedDistrict);
      setCoverageOverride(
        normalizedCoverage > 0 ? String(Math.round(normalizedCoverage * 100)) : '',
      );
      setFarOverride(
        normalizedFAR > 0 ? String(Math.round(normalizedFAR * 100)) : '',
      );
      setFireDistrict(matchedFire);

      setSearchStatus({
        state: 'success',
        address: confirmedAddress,
        district: matchedDistrict,
      });

      tryUpdate({
        dist: matchedDistrict,
        covOvr: normalizedCoverage > 0 ? normalizedCoverage : undefined,
        farOvr: normalizedFAR > 0 ? normalizedFAR : undefined,
        fireDist: matchedFire,
      });
    } catch {
      setSearchStatus({
        state: 'error',
        message: 'サーバーに接続できませんでした',
      });
    }
  };

  /* ---------------------------------------------------------------- */
  /*  File upload handler                                              */
  /* ---------------------------------------------------------------- */

  const handleFileUpload = useCallback(
    async (file: File) => {
      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'application/pdf',
      ];
      if (!validTypes.includes(file.type)) {
        setUploadStatus({
          state: 'error',
          message: '対応形式: JPEG, PNG, WebP, HEIC, PDF',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadStatus({
          state: 'error',
          message: 'ファイルサイズは10MB以下にしてください',
        });
        return;
      }

      setUploadStatus({ state: 'uploading' });

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/analyze-site', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadStatus({
            state: 'error',
            message: data.error || '解析に失敗しました',
          });
          return;
        }

        const data: AnalyzeSiteResponse = await res.json();

        if (data.error) {
          setUploadStatus({ state: 'error', message: data.error });
          return;
        }

        // Apply extracted site data
        const siteData = data.site;
        if (siteData) {
          if (siteData.frontageWidth && siteData.frontageWidth > 0) {
            setSiteWidth(String(siteData.frontageWidth));
          }
          if (siteData.depth && siteData.depth > 0) {
            setSiteDepth(String(siteData.depth));
          }
        }

        // Apply road data
        const roadData = data.roads?.[0];
        if (roadData) {
          const dirMap: Record<string, RoadDirection> = {
            south: 'south',
            north: 'north',
            east: 'east',
            west: 'west',
          };
          const dir = roadData.direction ? dirMap[roadData.direction] : undefined;
          if (dir) setRoadDirection(dir);
          if (roadData.width && roadData.width > 0) {
            setRoadWidth(roadData.width);
            if (!ROAD_WIDTH_PRESETS.includes(roadData.width)) {
              setCustomRoadWidth(String(roadData.width));
            } else {
              setCustomRoadWidth('');
            }
          }
        }

        // Apply zoning data
        const zoningResult = data.zoning;
        if (zoningResult) {
          if (zoningResult.district) {
            const matched = matchDistrict(zoningResult.district);
            if (matched) setSelectedDistrict(matched);
          }
          if (
            zoningResult.coverageRatio !== null &&
            zoningResult.coverageRatio !== undefined
          ) {
            const normalized = normalizeRatio(zoningResult.coverageRatio);
            setCoverageOverride(
              normalized > 0 ? String(Math.round(normalized * 100)) : '',
            );
          }
          if (
            zoningResult.floorAreaRatio !== null &&
            zoningResult.floorAreaRatio !== undefined
          ) {
            const normalized = normalizeRatio(zoningResult.floorAreaRatio);
            setFarOverride(
              normalized > 0 ? String(Math.round(normalized * 100)) : '',
            );
          }
          if (zoningResult.fireDistrict) {
            setFireDistrict(matchFireDistrict(zoningResult.fireDistrict));
          }
        }

        // Trigger scene update with extracted data
        const w = siteData?.frontageWidth ?? parseFloat(siteWidth);
        const d = siteData?.depth ?? parseFloat(siteDepth);
        const dist =
          (zoningResult?.district ? matchDistrict(zoningResult.district) : null) ??
          selectedDistrict;
        const rDir = roadData?.direction
          ? ({ south: 'south', north: 'north', east: 'east', west: 'west' } as Record<string, RoadDirection>)[roadData.direction] ?? roadDirection
          : roadDirection;
        const rw = roadData?.width ?? roadWidth;
        const cov =
          zoningResult?.coverageRatio != null
            ? normalizeRatio(zoningResult.coverageRatio)
            : undefined;
        const far =
          zoningResult?.floorAreaRatio != null
            ? normalizeRatio(zoningResult.floorAreaRatio)
            : undefined;
        const fire = zoningResult?.fireDistrict
          ? matchFireDistrict(zoningResult.fireDistrict)
          : undefined;

        if (dist && !isNaN(w) && w > 0 && !isNaN(d) && d > 0) {
          updateScene(
            w,
            d,
            dist,
            rw,
            rDir,
            cov && cov > 0 ? cov : undefined,
            far && far > 0 ? far : undefined,
            fire,
          );
        }

        setUploadStatus({
          state: 'success',
          notes:
            data.notes ||
            `${data.confidence === 'high' ? '高精度' : data.confidence === 'medium' ? '中精度' : '低精度'}で読み取りました`,
        });
      } catch {
        setUploadStatus({
          state: 'error',
          message: 'サーバーに接続できませんでした',
        });
      }
    },
    [
      siteWidth,
      siteDepth,
      selectedDistrict,
      roadWidth,
      roadDirection,
      updateScene,
    ],
  );

  const handleFileDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [handleFileUpload],
  );

  const handleDistrictSelect = (dist: ZoningDistrict) => {
    setSelectedDistrict(dist);
    tryUpdate({ dist });
  };

  const handleSiteWidth = (v: string) => {
    setSiteWidth(v);
    const w = parseFloat(v);
    if (!isNaN(w) && w > 0) tryUpdate({ w });
  };

  const handleSiteDepth = (v: string) => {
    setSiteDepth(v);
    const d = parseFloat(v);
    if (!isNaN(d) && d > 0) tryUpdate({ d });
  };

  const handleRoadWidthPreset = (w: number) => {
    setRoadWidth(w);
    setCustomRoadWidth('');
    tryUpdate({ rw: w });
  };

  const handleCustomRoadWidth = (v: string) => {
    setCustomRoadWidth(v);
    const w = parseFloat(v);
    if (!isNaN(w) && w > 0) {
      setRoadWidth(w);
      tryUpdate({ rw: w });
    }
  };

  const handleRoadDirection = (dir: RoadDirection) => {
    setRoadDirection(dir);
    tryUpdate({ rDir: dir });
  };

  const handleCoverageChange = (v: string) => {
    setCoverageOverride(v);
    const parsed = parseFloat(v);
    if (!isNaN(parsed)) {
      tryUpdate({ covOvr: parsed / 100 });
    } else {
      tryUpdate({});
    }
  };

  const handleFarChange = (v: string) => {
    setFarOverride(v);
    const parsed = parseFloat(v);
    if (!isNaN(parsed)) {
      tryUpdate({ farOvr: parsed / 100 });
    } else {
      tryUpdate({});
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* 1. 住所検索 */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          住所検索
        </label>
        <div className="flex gap-1">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleAddressSearch()}
            placeholder="東京都渋谷区..."
            disabled={isSearching}
            className="flex-1 rounded border border-gray-600 bg-gray-800 px-2 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleAddressSearch}
            disabled={isSearching || externalLoading || !address.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1"
          >
            {isSearching ? (
              <>
                <Spinner className="text-white" />
                <span>検索中</span>
              </>
            ) : (
              '検索'
            )}
          </button>
        </div>

        {searchStatus.state === 'success' && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-green-900/20 border border-green-800/40 px-2 py-1.5">
            <svg
              className="mt-0.5 shrink-0 text-green-400"
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] text-green-300 truncate">
                {searchStatus.address}
              </p>
              <p className="text-[10px] text-green-400/70">
                {shortenDistrict(searchStatus.district)} を自動設定しました
              </p>
            </div>
          </div>
        )}

        {searchStatus.state === 'zoning-not-found' && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-amber-900/20 border border-amber-800/40 px-2 py-1.5">
            <svg
              className="mt-0.5 shrink-0 text-amber-400"
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-[10px] text-amber-300 truncate">
                {searchStatus.address}
              </p>
              <p className="text-[10px] text-amber-400/70">
                用途地域を下から選択してください
              </p>
            </div>
          </div>
        )}

        {searchStatus.state === 'zoning-loading' && (
          <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1">
            <Spinner className="text-blue-400" />
            <p className="text-[10px] text-blue-300 truncate">
              {searchStatus.address} の用途地域を取得中...
            </p>
          </div>
        )}

        {searchStatus.state === 'error' && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-red-900/20 border border-red-800/40 px-2 py-1.5">
            <svg
              className="mt-0.5 shrink-0 text-red-400"
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-[10px] text-red-300">{searchStatus.message}</p>
          </div>
        )}
      </div>

      {/* 2. 図面アップロード */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
          図面から読み取り
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 py-3 cursor-pointer transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-400 bg-gray-800/30'
          } ${uploadStatus.state === 'uploading' ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={handleFileInput}
            className="hidden"
          />
          {uploadStatus.state === 'uploading' ? (
            <div className="flex items-center gap-2">
              <Spinner className="text-blue-400" />
              <span className="text-xs text-blue-300">AI解析中...</span>
            </div>
          ) : (
            <>
              <svg
                className="text-gray-400"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-[10px] text-gray-400">
                測量図・概要書をドロップ
              </span>
              <span className="text-[10px] text-gray-500">
                JPEG, PNG, PDF (10MB以下)
              </span>
            </>
          )}
        </div>

        {uploadStatus.state === 'success' && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-green-900/20 border border-green-800/40 px-2 py-1.5">
            <svg
              className="mt-0.5 shrink-0 text-green-400"
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-[10px] text-green-300">{uploadStatus.notes}</p>
          </div>
        )}

        {uploadStatus.state === 'error' && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-red-900/20 border border-red-800/40 px-2 py-1.5">
            <svg
              className="mt-0.5 shrink-0 text-red-400"
              width="12"
              height="12"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-[10px] text-red-300">{uploadStatus.message}</p>
          </div>
        )}
      </div>

      {/* 3. デモデータを使う */}
      <button
        onClick={onLoadDemo}
        className="w-full rounded border border-dashed border-gray-500 px-3 py-2 text-xs text-gray-300 hover:border-blue-400 hover:text-blue-400 transition-colors"
      >
        デモデータを使う
      </button>

      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-gray-700" />
        <span className="text-[10px] text-gray-500">設定</span>
        <div className="flex-1 border-t border-gray-700" />
      </div>

      {/* 3. 用途地域 */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          用途地域
        </label>
        {DISTRICT_GROUPS.map((group) => (
          <div key={group.label} className="mb-1.5">
            <span className="block text-[10px] text-gray-500 mb-0.5">{group.label}</span>
            <div className="grid grid-cols-2 gap-0.5">
              {group.districts.map((district) => {
                const isActive = selectedDistrict === district;
                return (
                  <button
                    key={district}
                    onClick={() => handleDistrictSelect(district)}
                    title={district}
                    className={`rounded px-1.5 py-1 text-[10px] font-medium transition-colors truncate ${
                      isActive ? group.activeBgClass : group.bgClass
                    }`}
                  >
                    {shortenDistrict(district)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 4. 建ぺい率 / 容積率 */}
      {selectedDistrict && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">建ぺい率 (%)</label>
            <input
              type="number"
              value={coverageOverride}
              onChange={(e) => handleCoverageChange(e.target.value)}
              placeholder={String(
                Math.round(getZoningDefaults(selectedDistrict).defaultCoverageRatio * 100),
              )}
              min="0"
              max="100"
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-0.5">容積率 (%)</label>
            <input
              type="number"
              value={farOverride}
              onChange={(e) => handleFarChange(e.target.value)}
              placeholder={String(
                Math.round(getZoningDefaults(selectedDistrict).defaultFloorAreaRatio * 100),
              )}
              min="0"
              max="1300"
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* 防火地域 / 角地 / 高度地区 */}
      {selectedDistrict && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              防火地域
            </label>
            <div className="flex gap-1">
              {(['指定なし', '準防火地域', '防火地域'] as FireDistrict[]).map((fd) => (
                <button
                  key={fd}
                  onClick={() => {
                    setFireDistrict(fd);
                    tryUpdate({ fireDist: fd });
                  }}
                  className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                    fireDistrict === fd
                      ? 'bg-red-600/80 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {fd === '指定なし' ? 'なし' : fd.replace('地域', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isCornerLot}
                onChange={(e) => {
                  setIsCornerLot(e.target.checked);
                  tryUpdate({ cornerLot: e.target.checked });
                }}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 w-3.5 h-3.5"
              />
              <span className="text-[10px] text-gray-300">角地 (建ぺい率+10%)</span>
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              高度地区
            </label>
            <div className="flex gap-1">
              {(['指定なし', '第一種', '第二種', '第三種'] as HeightDistrict['type'][]).map((hd) => (
                <button
                  key={hd}
                  onClick={() => {
                    setHeightDistrictType(hd);
                    tryUpdate({ hdType: hd });
                  }}
                  className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                    heightDistrictType === hd
                      ? 'bg-purple-600/80 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {hd === '指定なし' ? 'なし' : hd}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 5. 敷地形状 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            敷地形状
          </label>
          <div className="flex rounded overflow-hidden border border-gray-600">
            <button
              onClick={() => setSiteMode('rect')}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                siteMode === 'rect'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              矩形
            </button>
            <button
              onClick={() => setSiteMode('polygon')}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                siteMode === 'polygon'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              多角形
            </button>
          </div>
        </div>

        {siteMode === 'rect' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">間口 (m)</label>
                <input
                  type="number"
                  value={siteWidth}
                  onChange={(e) => handleSiteWidth(e.target.value)}
                  placeholder="10"
                  min="1"
                  step="0.5"
                  className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">奥行 (m)</label>
                <input
                  type="number"
                  value={siteDepth}
                  onChange={(e) => handleSiteDepth(e.target.value)}
                  placeholder="15"
                  min="1"
                  step="0.5"
                  className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            {site && (
              <div className="mt-1 text-[10px] text-gray-500">
                敷地面積: <span className="font-mono text-gray-300">{site.area.toFixed(1)}</span> m²
              </div>
            )}
          </>
        ) : (
          <PolygonSiteInput onSiteChange={onSiteChange} />
        )}
      </div>

      {/* 6. 前面道路 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            前面道路
          </label>
          {roadConfigs.length < 4 && (
            <button
              onClick={() => {
                // Pick a direction not yet used
                const usedDirs = roadConfigs.map((r) => r.direction);
                const availableDir = (['south', 'east', 'west', 'north'] as RoadDirection[]).find(
                  (d) => !usedDirs.includes(d),
                ) ?? 'south';
                const newConfigs = [
                  ...roadConfigs,
                  { id: String(Date.now()), width: 6, direction: availableDir, customWidth: '' },
                ];
                setRoadConfigs(newConfigs);
                // Auto-detect corner lot: 2+ roads with perpendicular directions
                if (newConfigs.length >= 2) {
                  setIsCornerLot(true);
                  tryUpdate({ cornerLot: true, allRoads: newConfigs });
                }
              }}
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              + 道路を追加
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {roadConfigs.map((rc, idx) => (
            <div key={rc.id} className="rounded border border-gray-700 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">道路 {idx + 1}</span>
                {roadConfigs.length > 1 && (
                  <button
                    onClick={() => {
                      const newConfigs = roadConfigs.filter((r) => r.id !== rc.id);
                      setRoadConfigs(newConfigs);
                      if (newConfigs.length < 2) {
                        setIsCornerLot(false);
                        tryUpdate({ cornerLot: false, allRoads: newConfigs });
                      } else {
                        tryUpdate({ allRoads: newConfigs });
                      }
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    削除
                  </button>
                )}
              </div>

              {/* Direction */}
              <div className="flex gap-1 mb-1">
                {ROAD_DIRECTION_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => {
                      const newConfigs = roadConfigs.map((r) =>
                        r.id === rc.id ? { ...r, direction: key } : r,
                      );
                      setRoadConfigs(newConfigs);
                      tryUpdate({ allRoads: newConfigs });
                    }}
                    className={`flex-1 rounded px-2 py-1 text-[10px] font-medium transition-colors ${
                      rc.direction === key
                        ? 'bg-gray-500 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Width presets + custom */}
              <div className="flex gap-1 mb-1">
                {ROAD_WIDTH_PRESETS.map((w) => (
                  <button
                    key={w}
                    onClick={() => {
                      const newConfigs = roadConfigs.map((r) =>
                        r.id === rc.id ? { ...r, width: w, customWidth: '' } : r,
                      );
                      setRoadConfigs(newConfigs);
                      tryUpdate({ allRoads: newConfigs });
                    }}
                    className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition-colors ${
                      rc.width === w && !rc.customWidth
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {w}m
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={rc.customWidth}
                onChange={(e) => {
                  const v = e.target.value;
                  const parsed = parseFloat(v);
                  const newConfigs = roadConfigs.map((r) =>
                    r.id === rc.id
                      ? {
                          ...r,
                          customWidth: v,
                          width: !isNaN(parsed) && parsed > 0 ? parsed : r.width,
                        }
                      : r,
                  );
                  setRoadConfigs(newConfigs);
                  if (!isNaN(parsed) && parsed > 0) {
                    tryUpdate({ allRoads: newConfigs });
                  }
                }}
                placeholder="その他 (m)"
                min="2"
                max="50"
                step="0.5"
                className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-[10px] text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
