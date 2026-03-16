'use client';

import { useState, useRef, useCallback } from 'react';
import type { ZoningDistrict, FireDistrict, HeightDistrict } from '@/engine/types';
import { buildSiteFromGeoRing, inferDefaultRoadFromVertices } from '@/lib/site-shape';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, MapPin } from 'lucide-react';
import type { RoadCandidate, SearchStatus, SiteCallbacks } from './site-types';
import { getDistrictShortLabel } from './site-types';
import {
  matchDistrict,
  matchFireDistrict,
  matchHeightDistrictType,
  normalizeRatio,
  buildZoningData,
  buildRoadFromEdge,
} from './site-helpers';
import {
  deriveEffectiveZoningFromBreakdown,
  pickDefaultParcelIndex,
  toGeoRingFromParcel,
  summarizeDistrictBreakdown,
  type ParcelCandidate,
  type DistrictBreakdownItem,
} from './address-search-helpers';

interface AddressSearchProps extends SiteCallbacks {
  onDistrictDetected: (d: ZoningDistrict) => void;
  onCoverageDetected: (v: string) => void;
  onFarDetected: (v: string) => void;
  onFireDetected: (f: FireDistrict) => void;
  onHeightDetected?: (h: HeightDistrict['type']) => void;
}

interface ZoningLookupResponse {
  district: string;
  coverageRatio: number;
  floorAreaRatio: number;
  fireDistrict: string;
  districts?: Array<{
    district: string;
    ratio: number;
    coverageRatio?: number;
    floorAreaRatio?: number;
    fireDistrict?: string;
  }>;
}

interface RoadLookupResponse {
  roads?: Array<{
    edgeVertexIndices?: [number, number];
    width?: number;
    direction?: string;
    distance?: number;
    confidence?: 'high' | 'medium' | 'low';
    reasoning?: string;
    sourceLabel?: string;
    sourceDetail?: string;
    name?: string;
    highway?: string;
  }>;
  source?: 'osm-overpass' | 'geometry-heuristic';
  message?: string;
}

interface SiteShapeLookupResponse {
  site?: { vertices: { x: number; y: number }[]; area: number };
  roads?: Array<{
    edgeStart: { x: number; y: number };
    edgeEnd: { x: number; y: number };
    width: number;
    centerOffset: number;
    bearing: number;
  }>;
  siteCoordinates?: [number, number][];
}

function parseSiteCoordinates(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const points: [number, number][] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const [lng, lat] = item;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    points.push([lng, lat]);
  }
  const first = points[0];
  const last = points[points.length - 1];
  const isClosed = Math.abs(first[0] - last[0]) < 1e-12 && Math.abs(first[1] - last[1]) < 1e-12;
  if (isClosed) points.pop();
  return points.length >= 3 ? points : null;
}

function parseParcelCandidates(payload: unknown): ParcelCandidate[] {
  if (!payload || typeof payload !== 'object') return [];
  const parcelsRaw = (payload as { parcels?: unknown }).parcels;
  if (!Array.isArray(parcelsRaw)) return [];

  const candidates: ParcelCandidate[] = [];
  for (const item of parcelsRaw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as {
      chiban?: unknown;
      containsPoint?: unknown;
      coordinates?: unknown;
      distanceMeters?: unknown;
    };
    if (typeof obj.chiban !== 'string' || !Array.isArray(obj.coordinates)) continue;
    candidates.push({
      chiban: obj.chiban,
      containsPoint: Boolean(obj.containsPoint),
      coordinates: obj.coordinates as [number, number][][],
      distanceMeters: typeof obj.distanceMeters === 'number' && Number.isFinite(obj.distanceMeters)
        ? obj.distanceMeters
        : null,
    });
  }
  return candidates;
}

export function AddressSearch({
  onSiteChange,
  onSitePrecisionChange,
  onRoadsChange,
  onLatitudeChange,
  onZoningChange,
  onDistrictDetected,
  onCoverageDetected,
  onFarDetected,
  onFireDetected,
  onHeightDetected,
}: AddressSearchProps) {
  const [address, setAddress] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>({ state: 'idle' });
  const [parcelCandidates, setParcelCandidates] = useState<ParcelCandidate[]>([]);
  const [selectedParcelIndex, setSelectedParcelIndex] = useState<number>(-1);
  const [districtBreakdown, setDistrictBreakdown] = useState<DistrictBreakdownItem[]>([]);
  const [parcelStatusMessage, setParcelStatusMessage] = useState<string | null>(null);

  const latLngRef = useRef<{ lat: number; lng: number } | null>(null);
  const confirmedAddressRef = useRef<string>('');
  const plateauRef = useRef<{
    heightDistrict?: {
      type: HeightDistrict['type'];
      absoluteMax?: number;
      autoDetected?: boolean;
    };
    districtPlan?: {
      name: string;
      restrictions?: string;
      maxHeight?: number;
    } | null;
  }>({ districtPlan: null });

  const isSearching =
    searchStatus.state === 'loading' || searchStatus.state === 'zoning-loading';

  const fetchRoadsFromLookup = useCallback(async (
    lat: number,
    lng: number,
    siteCoordinates: [number, number][],
    siteVertices: { x: number; y: number }[],
  ) => {
    try {
      const roadRes = await fetch('/api/road-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, siteCoordinates }),
      });
      if (!roadRes.ok) return null;

      const payload: RoadLookupResponse = await roadRes.json();
      if (payload.source === 'geometry-heuristic' && payload.message) {
        setParcelStatusMessage(payload.message);
      } else if (payload.source === 'osm-overpass') {
        setParcelStatusMessage(null);
      }
      if (!Array.isArray(payload.roads) || payload.roads.length === 0) {
        return { roads: [] as ReturnType<typeof buildRoadFromEdge>[], candidates: [] as RoadCandidate[], message: payload.message ?? null };
      }

      const candidates = payload.roads.map((road) => {
        const width = typeof road.width === 'number' && road.width > 0 ? road.width : 6;
        const edge = Array.isArray(road.edgeVertexIndices) &&
          road.edgeVertexIndices.length === 2 &&
          Number.isInteger(road.edgeVertexIndices[0]) &&
          Number.isInteger(road.edgeVertexIndices[1])
          ? [road.edgeVertexIndices[0], road.edgeVertexIndices[1]] as [number, number]
          : undefined;

        return {
          width,
          edgeVertexIndices: edge,
          direction:
            road.direction === 'north' || road.direction === 'south' || road.direction === 'east' || road.direction === 'west'
              ? road.direction
              : 'south',
          source: 'api' as const,
          confidence: road.confidence ?? 'low',
          reasoning: road.reasoning,
          sourceLabel: road.sourceLabel,
          sourceDetail: road.sourceDetail,
          distance: typeof road.distance === 'number' ? road.distance : null,
          name: road.name,
          highway: road.highway,
        } satisfies RoadCandidate;
      });

      const roads = candidates
        .map((candidate) => {
          return buildRoadFromEdge(siteVertices, candidate.width, candidate.edgeVertexIndices, candidate.direction);
        })
        .slice(0, Math.max(1, Math.min(6, siteVertices.length)));
      return {
        roads,
        candidates: candidates.slice(0, Math.max(1, Math.min(6, siteVertices.length))),
        message: payload.message ?? null,
      };
    } catch {
      return null;
    }
  }, []);

  const applyGeoRingGeometry = useCallback(async (
    ring: { lat: number; lng: number }[] | null,
    lat: number,
    lng: number,
  ): Promise<{
    siteDetected: boolean;
    siteCoordinates: [number, number][] | null;
  }> => {
    if (!ring) return { siteDetected: false, siteCoordinates: null };

    const site = buildSiteFromGeoRing(ring);
    if (!site) return { siteDetected: false, siteCoordinates: null };

    const siteCoordinates = ring.map((point) => [point.lng, point.lat] as [number, number]);
    onSiteChange(site);
    onSitePrecisionChange('approximate');
    const inferredRoadResult = await fetchRoadsFromLookup(lat, lng, siteCoordinates, site.vertices);
    if (inferredRoadResult && inferredRoadResult.roads.length > 0) {
      onRoadsChange(inferredRoadResult.roads, {
        source: 'api',
        candidates: inferredRoadResult.candidates,
        message: inferredRoadResult.message,
      });
    } else {
      const defaultRoad = inferDefaultRoadFromVertices(site.vertices, 6);
      onRoadsChange(defaultRoad ? [defaultRoad] : [], {
        source: 'manual',
        message: '接道候補を取得できなかったため、暫定の道路候補を配置しました。',
      });
    }

    return {
      siteDetected: true,
      siteCoordinates,
    };
  }, [onSiteChange, onSitePrecisionChange, onRoadsChange, fetchRoadsFromLookup]);

  const fetchZoning = useCallback(async (
    lat: number,
    lng: number,
    siteCoordinates: [number, number][] | null,
  ): Promise<ZoningLookupResponse | null> => {
    const zoningRes = await fetch('/api/zoning-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat,
        lng,
        ...(siteCoordinates ? { siteCoordinates } : {}),
      }),
    });
    if (!zoningRes.ok) return null;
    return zoningRes.json();
  }, []);

  const applyZoningResult = useCallback((
    zoningData: ZoningLookupResponse,
    confirmedAddress: string,
    siteDetected: boolean,
  ) => {
    const matchedDistrict = matchDistrict(zoningData.district);
    if (!matchedDistrict) {
      setSearchStatus({ state: 'zoning-not-found', address: confirmedAddress });
      return;
    }

    const breakdown = Array.isArray(zoningData.districts)
      ? zoningData.districts
          .map((item) => ({
            district: String(item?.district ?? ''),
            ratio: Number(item?.ratio ?? 0),
            coverageRatio: Number(item?.coverageRatio ?? Number.NaN),
            floorAreaRatio: Number(item?.floorAreaRatio ?? Number.NaN),
            fireDistrict: typeof item?.fireDistrict === 'string' ? item.fireDistrict : undefined,
          }))
          .filter((item) => item.district.length > 0 && Number.isFinite(item.ratio) && item.ratio > 0)
      : [];

    const effectiveFromBreakdown = deriveEffectiveZoningFromBreakdown(breakdown);
    const normalizedCoverage = effectiveFromBreakdown
      ? effectiveFromBreakdown.coverageRatio
      : normalizeRatio(zoningData.coverageRatio);
    const normalizedFAR = effectiveFromBreakdown
      ? effectiveFromBreakdown.floorAreaRatio
      : normalizeRatio(zoningData.floorAreaRatio);
    const matchedFire = effectiveFromBreakdown
      ? matchFireDistrict(effectiveFromBreakdown.fireDistrict)
      : matchFireDistrict(zoningData.fireDistrict);

    setDistrictBreakdown(breakdown);
    onDistrictDetected(matchedDistrict);
    onCoverageDetected(normalizedCoverage > 0 ? String(Math.round(normalizedCoverage * 100)) : '');
    onFarDetected(normalizedFAR > 0 ? String(Math.round(normalizedFAR * 100)) : '');
    onFireDetected(matchedFire);

    setSearchStatus({
      state: 'success',
      address: confirmedAddress,
      district: matchedDistrict,
      siteDetected,
    });

    onZoningChange(
      buildZoningData(matchedDistrict, {
        coverageRatio: normalizedCoverage > 0 ? normalizedCoverage : undefined,
        floorAreaRatio: normalizedFAR > 0 ? normalizedFAR : undefined,
        fireDistrict: matchedFire,
        heightDistrict: plateauRef.current.heightDistrict,
        districtPlan: plateauRef.current.districtPlan ?? null,
      }),
    );
  }, [
    onDistrictDetected,
    onCoverageDetected,
    onFarDetected,
    onFireDetected,
    onZoningChange,
  ]);

  const handleSearch = useCallback(async () => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setSearchStatus({ state: 'loading' });
    setDistrictBreakdown([]);
    setParcelCandidates([]);
    setSelectedParcelIndex(-1);
    setParcelStatusMessage(null);

    try {
      const geocodeRes = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed }),
      });

      if (!geocodeRes.ok) {
        const data = await geocodeRes.json().catch(() => ({}));
        setSearchStatus({ state: 'error', message: data.error || '住所を見つけられませんでした。' });
        return;
      }

      const geocodeData: { lat: number; lng: number; address: string } =
        await geocodeRes.json();
      const { lat, lng, address: confirmedAddress } = geocodeData;

      latLngRef.current = { lat, lng };
      confirmedAddressRef.current = confirmedAddress;
      onLatitudeChange(lat);

      setSearchStatus({ state: 'zoning-loading', address: confirmedAddress, lat, lng });

      const [shapeRes, plateauRes, parcelRes] = await Promise.allSettled([
        fetch('/api/site-shape-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, address: confirmedAddress }),
        }),
        fetch('/api/plateau-urf-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        }),
        fetch('/api/parcel-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        }),
      ]);

      let siteDetected = false;
      let selectedSiteCoordinates: [number, number][] | null = null;

      if (parcelRes.status === 'fulfilled' && parcelRes.value.ok) {
        const parcelPayload = await parcelRes.value.json();
        const candidates = parseParcelCandidates(parcelPayload);
        if (candidates.length > 0) {
          setParcelCandidates(candidates);
          const defaultIndex = pickDefaultParcelIndex(candidates);
          setSelectedParcelIndex(defaultIndex);
          if (defaultIndex >= 0) {
            setParcelStatusMessage(null);
            const selectedParcel = candidates[defaultIndex];
            const selectedRing = toGeoRingFromParcel(selectedParcel);
            const applied = await applyGeoRingGeometry(selectedRing, lat, lng);
            siteDetected = applied.siteDetected;
            selectedSiteCoordinates = applied.siteCoordinates;
          } else {
            setParcelStatusMessage(
              typeof parcelPayload?.message === 'string'
                ? `${parcelPayload.message} 候補筆を選択してください。`
                : '候補筆が複数あります。選択してください。',
            );
          }
        } else {
          setParcelStatusMessage(
            typeof parcelPayload?.message === 'string'
              ? parcelPayload.message
              : 'この地点では候補敷地を取得できませんでした。',
          );
        }
      } else {
        setParcelStatusMessage('候補敷地の取得に失敗しました。');
      }

      if (!siteDetected && shapeRes.status === 'fulfilled' && shapeRes.value.ok) {
        const shapeData: SiteShapeLookupResponse = await shapeRes.value.json();

        if (shapeData.site && Array.isArray(shapeData.site.vertices) && shapeData.site.vertices.length >= 3) {
          onSiteChange(shapeData.site);
          onSitePrecisionChange('approximate');
          siteDetected = true;

          const shapeSiteCoordinates = parseSiteCoordinates(shapeData.siteCoordinates);
          if (shapeSiteCoordinates) {
            selectedSiteCoordinates = shapeSiteCoordinates;
            const inferredRoadResult = await fetchRoadsFromLookup(lat, lng, shapeSiteCoordinates, shapeData.site.vertices);
            if (inferredRoadResult && inferredRoadResult.roads.length > 0) {
              onRoadsChange(inferredRoadResult.roads, {
                source: 'api',
                candidates: inferredRoadResult.candidates,
                message: inferredRoadResult.message,
              });
            } else if (Array.isArray(shapeData.roads) && shapeData.roads.length > 0) {
              onRoadsChange(shapeData.roads, { source: 'api' });
            }
          } else if (Array.isArray(shapeData.roads) && shapeData.roads.length > 0) {
            onRoadsChange(shapeData.roads, { source: 'api' });
          }
        } else if (Array.isArray(shapeData.roads) && shapeData.roads.length > 0) {
          onRoadsChange(shapeData.roads, { source: 'api' });
        }
      }

      let plateauHeightDistrict:
        | {
            type: HeightDistrict['type'];
            absoluteMax?: number;
            autoDetected?: boolean;
          }
        | undefined;
      let plateauDistrictPlan: {
        name: string;
        restrictions?: string;
        maxHeight?: number;
        minHeight?: number;
        wallSetback?: number;
        floorAreaRatio?: number;
        coverageRatio?: number;
      } | null = null;

      if (plateauRes.status === 'fulfilled' && plateauRes.value.ok) {
        const plateauData: {
          heightDistrict?: { type?: string; maxHeight?: number };
          districtPlan?: {
            name: string;
            restrictions?: string;
            maxHeight?: number;
            minHeight?: number;
            wallSetback?: number;
            floorAreaRatio?: number;
            coverageRatio?: number;
          };
        } = await plateauRes.value.json();

        if (plateauData.heightDistrict?.type) {
          const hdType = matchHeightDistrictType(plateauData.heightDistrict.type);
          if (hdType) {
            plateauHeightDistrict = {
              type: hdType,
              absoluteMax: plateauData.heightDistrict.maxHeight,
              autoDetected: true,
            };
            onHeightDetected?.(hdType);
          }
        }

        if (plateauData.districtPlan?.name) {
          plateauDistrictPlan = {
            name: plateauData.districtPlan.name,
            restrictions: plateauData.districtPlan.restrictions,
            maxHeight: plateauData.districtPlan.maxHeight,
            minHeight: plateauData.districtPlan.minHeight,
            wallSetback: plateauData.districtPlan.wallSetback,
            floorAreaRatio: plateauData.districtPlan.floorAreaRatio,
            coverageRatio: plateauData.districtPlan.coverageRatio,
          };
        }
      }

      plateauRef.current = {
        heightDistrict: plateauHeightDistrict,
        districtPlan: plateauDistrictPlan,
      };

      const zoningData = await fetchZoning(lat, lng, selectedSiteCoordinates);
      if (!zoningData) {
        setSearchStatus({ state: 'zoning-not-found', address: confirmedAddress });
        return;
      }

      applyZoningResult(zoningData, confirmedAddress, siteDetected);
    } catch {
      setSearchStatus({ state: 'error', message: 'サーバーに接続できませんでした。' });
    }
  }, [
    address,
    onLatitudeChange,
    onSiteChange,
    onRoadsChange,
    onSitePrecisionChange,
    onHeightDetected,
    applyGeoRingGeometry,
    fetchRoadsFromLookup,
    fetchZoning,
    applyZoningResult,
  ]);

  const handleParcelChange = useCallback(async (nextIndex: number) => {
    if (!Number.isInteger(nextIndex) || nextIndex < 0) return;
    setSelectedParcelIndex(nextIndex);

    const latLng = latLngRef.current;
    const confirmedAddress = confirmedAddressRef.current;
    const parcel = parcelCandidates[nextIndex] ?? null;
    if (!parcel || !latLng || !confirmedAddress) return;

    const ring = toGeoRingFromParcel(parcel);
    const applied = await applyGeoRingGeometry(ring, latLng.lat, latLng.lng);

    setParcelStatusMessage(null);

    setSearchStatus({
      state: 'zoning-loading',
      address: confirmedAddress,
      lat: latLng.lat,
      lng: latLng.lng,
    });

    try {
      const zoningData = await fetchZoning(latLng.lat, latLng.lng, applied.siteCoordinates);
      if (!zoningData) {
        setSearchStatus({ state: 'zoning-not-found', address: confirmedAddress });
        return;
      }
      applyZoningResult(zoningData, confirmedAddress, applied.siteDetected);
    } catch {
      setSearchStatus({ state: 'error', message: '用途地域の取得に失敗しました。' });
    }
  }, [parcelCandidates, applyGeoRingGeometry, fetchZoning, applyZoningResult]);

  const parcelOptions = parcelCandidates.map((parcel, index) => ({
    key: `${parcel.chiban}-${index}`,
    value: String(index),
    label: [
      parcel.containsPoint ? '候補' : null,
      `地番: ${parcel.chiban}`,
      !parcel.containsPoint && typeof parcel.distanceMeters === 'number'
        ? `約${Math.round(parcel.distanceMeters)}m`
        : null,
    ].filter(Boolean).join(' / '),
  }));

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">住所から自動取得</label>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          住所入力から敷地候補、接道、用途地域をまとめて取得します。
        </p>
      </div>
      <div className="flex gap-1.5">
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isSearching && handleSearch()}
          placeholder="例: 東京都新宿区西新宿2-8-1"
          disabled={isSearching}
          className="h-9 text-sm"
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching || !address.trim()}
          size="sm"
          className="h-9 shrink-0 px-4"
        >
          {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '検索'}
        </Button>
      </div>

      {parcelCandidates.length > 0 && (
        <div className="rounded-lg border border-white/70 bg-white/72 px-2.5 py-2 shadow-sm">
          <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            候補筆を選択
          </div>
          <select
            value={selectedParcelIndex >= 0 ? String(selectedParcelIndex) : ''}
            onChange={(e) => {
              if (e.target.value === '') return;
              void handleParcelChange(Number(e.target.value));
            }}
            disabled={isSearching}
            className="h-8 w-full rounded border border-input bg-background px-2 text-xs text-foreground"
          >
            {selectedParcelIndex < 0 && (
              <option value="">候補を選択してください</option>
            )}
            {parcelOptions.map((option) => (
              <option key={option.key} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {parcelCandidates.length === 0 && parcelStatusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-2 shadow-sm">
          <p className="text-[10px] text-amber-900">{parcelStatusMessage}</p>
        </div>
      )}

      {searchStatus.state === 'success' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 px-2.5 py-2 shadow-sm">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-700" />
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-900 truncate">{searchStatus.address}</p>
            <p className="text-[10px] text-emerald-800/80">
              {getDistrictShortLabel(searchStatus.district)} を反映しました
              {searchStatus.siteDetected ? ' / 敷地形状も取得済み' : ''}
            </p>
            {!searchStatus.siteDetected && (
              <p className="text-[10px] text-amber-800/90">
                敷地形状はまだ確定していません。候補筆の選択か手入力で補完してください。
              </p>
            )}
            {districtBreakdown.length > 1 && (
              <p className="text-[10px] text-emerald-800/80 truncate">
                混在: {summarizeDistrictBreakdown(districtBreakdown)}
              </p>
            )}
          </div>
        </div>
      )}

      {searchStatus.state === 'zoning-not-found' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-2 shadow-sm">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="text-[11px] text-amber-900 truncate">{searchStatus.address}</p>
            <p className="text-[10px] text-amber-800/80">用途地域を見つけられませんでした。</p>
          </div>
        </div>
      )}

      {searchStatus.state === 'zoning-loading' && (
        <div className="flex items-center gap-1.5 px-2.5 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <p className="text-[11px] text-primary/80 truncate">
            {searchStatus.address} の用途地域を取得中...
          </p>
        </div>
      )}

      {searchStatus.state === 'error' && (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50/90 px-2.5 py-2 shadow-sm">
          <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-700" />
          <p className="text-[11px] text-rose-900">{searchStatus.message}</p>
        </div>
      )}
    </div>
  );
}

