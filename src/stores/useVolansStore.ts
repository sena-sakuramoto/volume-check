'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';
import { DEMO_SITE, DEMO_ROADS, DEMO_ZONING } from '@/lib/demo-data';
import { buildSiteFromGeoRing, type GeoPoint } from '@/lib/site-shape';
import type { Point2D } from '@/engine/types';

export interface ParcelCandidate {
  chiban: string;
  /** Outer ring in [lng, lat] GeoJSON order */
  ring: GeoPoint[];
  distanceMeters: number | null;
  containsPoint: boolean;
}

export interface VolansProjectState {
  projectName: string;
  address: string;
  lat: number | null;
  lng: number | null;
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  latitude: number;
  floorHeights: number[];
  updatedAt: string;

  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  lastRunAt: string | null;
  /** human-readable current step while fetching (e.g. "地番取得中…") */
  progressLabel: string | null;

  /** parcel candidates from last address search (not persisted) */
  parcelCandidates: ParcelCandidate[];
  selectedParcelIndex: number;

  /** 天空率 optimisation result — set by searchMaxSkyVolume */
  skyMaxScale: number | null;
  skyWorstMargin: number | null;
  skyOptimizedAt: string | null;

  /**
   * Worst-margin point from the most recent per-point sky-factor analysis.
   * Populated by useSkyAnalysis so report pages can surface a real number.
   */
  skyAnalysisSummary: {
    worstValue: number;
    worstBaseline: number;
    worstMargin: number;
    worstMarginPct: number;
    worstLabel: string;
    totalPoints: number;
    allPass: boolean;
    analyzedAt: string;
  } | null;
}

export interface VolansStore extends VolansProjectState {
  setProjectName: (name: string) => void;
  setAddress: (address: string) => void;
  setSite: (site: SiteBoundary) => void;
  setRoads: (roads: Road[]) => void;
  setZoning: (zoning: ZoningData) => void;
  setFloorHeights: (heights: number[]) => void;

  fetchFromAddress: (address: string) => Promise<{ ok: boolean; message?: string }>;
  selectParcel: (index: number) => void;
  loadSnapshot: (snapshot: Partial<VolansProjectState>) => void;
  /**
   * Replace site from a CAD/DXF-derived polygon in local meters.
   * Optionally provide road edges that reference vertex indices on the site polygon.
   */
  setSiteFromCad: (
    polygon: Point2D[],
    opts?: { roadEdgeIndices?: Array<[number, number]>; roadWidthDefault?: number },
  ) => void;
  runAnalysis: () => Promise<void>;
  reset: () => void;
}

const INITIAL: VolansProjectState = {
  projectName: '新宿区西新宿3丁目計画',
  address: '東京都新宿区西新宿3丁目',
  lat: null,
  lng: null,
  site: DEMO_SITE,
  roads: DEMO_ROADS,
  zoning: { ...DEMO_ZONING, district: '商業地域', coverageRatio: 0.8, floorAreaRatio: 6.0 },
  latitude: 35.68,
  floorHeights: [4.2, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6],
  updatedAt: new Date().toISOString(),
  status: 'idle',
  error: null,
  lastRunAt: null,
  parcelCandidates: [],
  selectedParcelIndex: -1,
  progressLabel: null,
  skyMaxScale: null,
  skyWorstMargin: null,
  skyOptimizedAt: null,
  skyAnalysisSummary: null,
};

function normalizeRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? value / 100 : value;
}

/**
 * The parcel-lookup endpoint returns `coordinates: [lng, lat][][]` (multi-ring) per feature.
 * Pick the outer ring and flatten to { lat, lng } points.
 */
function flattenOuterRing(
  coords?: [number, number][][] | [number, number][],
): GeoPoint[] {
  if (!coords || !Array.isArray(coords) || coords.length === 0) return [];
  const first = coords[0] as unknown;
  if (!Array.isArray(first)) return [];
  const firstItem = first[0];
  // Determine shape: is `coords` a single ring (Array<[lng,lat]>) or multi-ring (Array<Array<[lng,lat]>>)?
  if (typeof firstItem === 'number') {
    // single ring
    return (coords as [number, number][])
      .map((p) => ({ lng: p[0], lat: p[1] }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }
  // multi-ring: take first ring
  const outer = coords[0] as [number, number][];
  return outer
    .map((p) => ({ lng: p[0], lat: p[1] }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

export const useVolansStore = create<VolansStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setProjectName: (name) => set({ projectName: name, updatedAt: new Date().toISOString() }),
      setAddress: (address) => set({ address }),
      setSite: (site) => set({ site, updatedAt: new Date().toISOString() }),
      setRoads: (roads) => set({ roads, updatedAt: new Date().toISOString() }),
      setZoning: (zoning) => set({ zoning, updatedAt: new Date().toISOString() }),
      setFloorHeights: (heights) => set({ floorHeights: heights }),

      async fetchFromAddress(address) {
        set({ status: 'loading', error: null, address, progressLabel: '住所を地理座標化…' });

        try {
          // 1. geocode
          const geoResp = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ address }),
          });
          if (!geoResp.ok) {
            const data = await geoResp.json().catch(() => ({}));
            throw new Error(data.error ?? '住所の地理座標化に失敗しました');
          }
          const geo = (await geoResp.json()) as { lat: number; lng: number; address?: string };

          // Immediately surface geo result so the map can render while
          // downstream lookups are still in flight.
          set({
            lat: geo.lat,
            lng: geo.lng,
            address: geo.address ?? address,
            latitude: geo.lat,
            progressLabel: '法規・筆界データを取得中…',
          });

          // Kick off zoning, parcel, and road lookups in parallel.
          const [zoningResp, parcelResp] = await Promise.all([
            fetch('/api/zoning-lookup', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ lat: geo.lat, lng: geo.lng }),
            }),
            fetch('/api/parcel-lookup', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ lat: geo.lat, lng: geo.lng, address }),
            }).catch(() => null),
          ]);

          const current = get();
          let nextZoning = current.zoning;
          if (zoningResp.ok) {
            const z = (await zoningResp.json()) as {
              district?: string;
              coverageRatio?: number;
              floorAreaRatio?: number;
              fireDistrict?: string;
            };
            nextZoning = {
              ...current.zoning,
              district: (z.district as ZoningData['district']) ?? current.zoning.district,
              coverageRatio:
                z.coverageRatio !== undefined
                  ? normalizeRatio(z.coverageRatio)
                  : current.zoning.coverageRatio,
              floorAreaRatio:
                z.floorAreaRatio !== undefined
                  ? normalizeRatio(z.floorAreaRatio)
                  : current.zoning.floorAreaRatio,
              fireDistrict:
                (z.fireDistrict as ZoningData['fireDistrict']) ?? current.zoning.fireDistrict,
            };
          }

          const parcelCandidates: ParcelCandidate[] = [];
          let nextSite = current.site;
          let chosenRing: GeoPoint[] | null = null;
          if (parcelResp && parcelResp.ok) {
            const pr = (await parcelResp.json()) as {
              parcels?: Array<{
                chiban?: string;
                coordinates?: [number, number][][] | [number, number][];
                containsPoint?: boolean;
                distanceMeters?: number | null;
              }>;
            };
            if (pr.parcels && pr.parcels.length > 0) {
              for (const p of pr.parcels) {
                const ring = flattenOuterRing(p.coordinates);
                if (ring.length >= 3) {
                  parcelCandidates.push({
                    chiban: p.chiban ?? '—',
                    ring,
                    distanceMeters: p.distanceMeters ?? null,
                    containsPoint: Boolean(p.containsPoint),
                  });
                }
              }
              // sort: containsPoint first, then by distance
              parcelCandidates.sort((a, b) => {
                if (a.containsPoint !== b.containsPoint) return a.containsPoint ? -1 : 1;
                return (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity);
              });
              const pick = parcelCandidates[0];
              if (pick) {
                const site = buildSiteFromGeoRing(pick.ring);
                if (site) {
                  nextSite = site;
                  chosenRing = pick.ring;
                }
              }
            }
          }

          // Surface zoning + parcels progressively (before the slower road lookup)
          set({
            zoning: nextZoning,
            site: nextSite,
            parcelCandidates,
            selectedParcelIndex: parcelCandidates.length > 0 ? 0 : -1,
            progressLabel: chosenRing ? '接道道路を推定中…' : null,
          });

          // Road auto-detection from selected parcel
          let nextRoads: Road[] = current.roads;
          if (chosenRing && chosenRing.length >= 3) {
            try {
              const siteCoordinates = chosenRing.map((p) => [p.lng, p.lat]);
              const roadResp = await fetch('/api/road-lookup', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  lat: geo.lat,
                  lng: geo.lng,
                  siteCoordinates,
                }),
              });
              if (roadResp.ok) {
                const rdata = (await roadResp.json()) as {
                  roads?: Array<{
                    edgeVertexIndices: [number, number];
                    width: number;
                    direction: 'north' | 'south' | 'east' | 'west';
                  }>;
                };
                if (rdata.roads && rdata.roads.length > 0 && nextSite.vertices.length >= 3) {
                  const bearingOf = (d: string): number => {
                    switch (d) {
                      case 'north':
                        return 0;
                      case 'east':
                        return 90;
                      case 'south':
                        return 180;
                      case 'west':
                        return 270;
                      default:
                        return 0;
                    }
                  };
                  nextRoads = rdata.roads
                    .map((r) => {
                      const [i, j] = r.edgeVertexIndices;
                      const A = nextSite.vertices[i];
                      const B = nextSite.vertices[j];
                      if (!A || !B) return null;
                      return {
                        edgeStart: A,
                        edgeEnd: B,
                        width: r.width > 0 ? r.width : 6,
                        centerOffset: (r.width > 0 ? r.width : 6) / 2,
                        bearing: bearingOf(r.direction),
                      } as Road;
                    })
                    .filter((r): r is Road => r !== null);
                }
              }
            } catch {
              // silent fail — keep current roads
            }
          }

          set({
            roads: nextRoads.length > 0 ? nextRoads : current.roads,
            status: 'ready',
            progressLabel: null,
            updatedAt: new Date().toISOString(),
          });
          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : '住所情報の取得に失敗しました';
          set({ status: 'error', error: msg, progressLabel: null });
          return { ok: false, message: msg };
        }
      },

      setSiteFromCad(polygon, opts) {
        if (polygon.length < 3) return;
        // normalize: translate to minX=0, minY=0; keep clockwise
        let minX = Infinity, minY = Infinity;
        for (const p of polygon) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
        }
        let verts = polygon.map((p) => ({ x: p.x - minX, y: p.y - minY }));
        // orient clockwise
        let signed = 0;
        for (let i = 0; i < verts.length; i++) {
          const j = (i + 1) % verts.length;
          signed += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
        }
        if (signed > 0) verts = [...verts].reverse();
        // compute area
        let a = 0;
        for (let i = 0; i < verts.length; i++) {
          const j = (i + 1) % verts.length;
          a += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
        }
        const area = Math.abs(a) / 2;
        if (!Number.isFinite(area) || area <= 0) return;

        let nextRoads: Road[] = get().roads;
        if (opts?.roadEdgeIndices && opts.roadEdgeIndices.length > 0) {
          const rw = opts.roadWidthDefault ?? 6;
          nextRoads = opts.roadEdgeIndices
            .map(([i, j]) => {
              const A = verts[i];
              const B = verts[j];
              if (!A || !B) return null;
              const dx = B.x - A.x;
              const dy = B.y - A.y;
              const len = Math.hypot(dx, dy);
              if (len < 0.1) return null;
              const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
              return {
                edgeStart: A,
                edgeEnd: B,
                width: rw,
                centerOffset: rw / 2,
                bearing,
              } as Road;
            })
            .filter(Boolean) as Road[];
        }

        set({
          site: { vertices: verts, area },
          roads: nextRoads.length > 0 ? nextRoads : get().roads,
          updatedAt: new Date().toISOString(),
        });
      },

      loadSnapshot(snapshot) {
        set({
          ...snapshot,
          updatedAt: new Date().toISOString(),
        });
      },

      selectParcel(index) {
        const { parcelCandidates } = get();
        const p = parcelCandidates[index];
        if (!p) return;
        const site = buildSiteFromGeoRing(p.ring);
        if (site) {
          set({
            site,
            selectedParcelIndex: index,
            updatedAt: new Date().toISOString(),
          });
        }
      },

      async runAnalysis() {
        // Engine runs reactively through useVolumeCalculation hook.
        // This flag just records that the user pressed 解析を実行.
        set({ lastRunAt: new Date().toISOString(), status: 'ready' });
      },

      reset: () => set({ ...INITIAL, updatedAt: new Date().toISOString() }),
    }),
    {
      name: 'volans-project-v1',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? window.localStorage : (undefined as unknown as Storage))),
      partialize: (state) => ({
        projectName: state.projectName,
        address: state.address,
        lat: state.lat,
        lng: state.lng,
        site: state.site,
        roads: state.roads,
        zoning: state.zoning,
        latitude: state.latitude,
        floorHeights: state.floorHeights,
        updatedAt: state.updatedAt,
        lastRunAt: state.lastRunAt,
        skyMaxScale: state.skyMaxScale,
        skyWorstMargin: state.skyWorstMargin,
        skyOptimizedAt: state.skyOptimizedAt,
        skyAnalysisSummary: state.skyAnalysisSummary,
        // NOTE: parcelCandidates intentionally not persisted (re-fetch on demand)
      }),
    },
  ),
);

/** Formatted updatedAt for display (YYYY/MM/DD HH:mm) */
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
