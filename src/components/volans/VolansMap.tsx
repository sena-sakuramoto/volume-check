'use client';

import { useEffect, useRef, useState } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';
import { buildSiteFromGeoRing } from '@/lib/site-shape';

interface VolansMapProps {
  height?: number;
  /** Show zoom controls */
  showZoom?: boolean;
}


/**
 * MapLibre map with OSM tiles, a red marker at the geocoded point,
 * parcel candidate polygons, and highlight on the selected parcel.
 * Tap a parcel polygon to select it (syncs store.selectedParcelIndex).
 */
export function VolansMap({ height = 220, showZoom = false }: VolansMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const lat = useVolansStore((s) => s.lat);
  const lng = useVolansStore((s) => s.lng);
  const candidates = useVolansStore((s) => s.parcelCandidates);
  const selectedIdx = useVolansStore((s) => s.selectedParcelIndex);
  const [toast, setToast] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;
  const [drawPoints, setDrawPoints] = useState<{ lat: number; lng: number }[]>([]);
  const drawPointsRef = useRef(drawPoints);
  drawPointsRef.current = drawPoints;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }

  function commitDrawing() {
    const pts = drawPointsRef.current;
    if (pts.length < 3) {
      showToast('頂点は3つ以上必要です');
      return;
    }
    const site = buildSiteFromGeoRing(pts);
    if (site) {
      useVolansStore.setState({
        site,
        siteSource: 'manual',
        updatedAt: new Date().toISOString(),
      });
      setDrawMode(false);
      setDrawPoints([]);
      showToast(`${pts.length}頂点の敷地を確定しました`);
    } else {
      showToast('敷地形状の確定に失敗しました');
    }
  }

  function cancelDrawing() {
    setDrawMode(false);
    setDrawPoints([]);
  }

  useEffect(() => {
    if (!containerRef.current || lat === null || lng === null) return;
    let cancelled = false;

    (async () => {
      const mod = await import('maplibre-gl');
      if (cancelled || !containerRef.current) return;

      const maplibregl = mod.default;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          sources: {
            base: {
              type: 'raster',
              // CartoDB Positron — raster OSM-derived tiles with CORS enabled
              // (the standard tile.openstreetmap.org CDN blocks fetch() from
              // other origins and breaks MapLibre's async tile loader).
              tiles: [
                'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              maxzoom: 19,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
            },
          },
          layers: [{ id: 'base-tiles', type: 'raster', source: 'base' }],
        },
        center: [lng, lat],
        zoom: 17.5,
        maxZoom: 19,
        attributionControl: { compact: true },
      });
      if (showZoom) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;

      new maplibregl.Marker({ color: '#ef4444' }).setLngLat([lng, lat]).addTo(map);

      map.on('load', () => {
        if (cancelled) return;
        const features = candidates.map((c, i) => ({
          type: 'Feature' as const,
          id: i,
          properties: { idx: i, chiban: c.chiban, selected: i === selectedIdx },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [c.ring.map((p) => [p.lng, p.lat])],
          },
        }));
        map.addSource('parcels', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });
        map.addLayer({
          id: 'parcels-fill',
          type: 'fill',
          source: 'parcels',
          paint: {
            'fill-color': [
              'case',
              ['get', 'selected'],
              '#3b6de1',
              '#3b6de1',
            ],
            'fill-opacity': [
              'case',
              ['get', 'selected'],
              0.45,
              0.18,
            ],
          },
        });
        map.addLayer({
          id: 'parcels-stroke',
          type: 'line',
          source: 'parcels',
          paint: {
            'line-color': [
              'case',
              ['get', 'selected'],
              '#2b57bf',
              '#3b6de1',
            ],
            'line-width': [
              'case',
              ['get', 'selected'],
              3,
              1.6,
            ],
            'line-dasharray': [
              'case',
              ['get', 'selected'],
              ['literal', [1, 0]],
              ['literal', [2, 2]],
            ],
          },
        });
        map.on('click', 'parcels-fill', (e) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const idx = (feat.properties as { idx?: number })?.idx;
          if (typeof idx === 'number') {
            useVolansStore.getState().selectParcel(idx);
            showToast(`地番 ${candidates[idx]?.chiban ?? '—'} を選択`);
          }
        });
        map.on('mouseenter', 'parcels-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'parcels-fill', () => {
          map.getCanvas().style.cursor = '';
        });

        // Map-wide click: either append a draw-mode vertex, or (outside
        // draw mode) do nothing — the parcels-fill handler above is the
        // authoritative "select site" interaction.
        map.on('click', (e: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
          if (!drawModeRef.current) return;
          const hit = map.queryRenderedFeatures(
            [e.point.x, e.point.y] as unknown as [number, number],
            { layers: ['parcels-fill'] },
          );
          if (hit && hit.length > 0) return;
          setDrawPoints((prev) => [...prev, { lat: e.lngLat.lat, lng: e.lngLat.lng }]);
        });
        map.on('mousemove', (e: { point: { x: number; y: number } }) => {
          const hit = map.queryRenderedFeatures(
            [e.point.x, e.point.y] as unknown as [number, number],
            { layers: ['parcels-fill'] },
          );
          if (drawModeRef.current) {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = hit && hit.length > 0 ? 'pointer' : '';
          }
        });
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mapRef.current as any).remove?.();
        mapRef.current = null;
      }
    };
    // `candidates` and `selectedIdx` feed the map INIT only; subsequent
    // changes are picked up by the dedicated highlight-update effect below.
    // Including them here would re-create the map on every tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, showZoom]);

  // Maintain a GeoJSON source for draw-mode vertices + edges
  useEffect(() => {
    const map = mapRef.current as unknown as {
      getSource?: (id: string) => { setData: (d: unknown) => void } | undefined;
      addSource?: (id: string, s: unknown) => void;
      addLayer?: (layer: unknown) => void;
    } | null;
    if (!map?.getSource) return;
    if (!map.getSource('draw')) {
      map.addSource?.('draw', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer?.({
        id: 'draw-line',
        type: 'line',
        source: 'draw',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#f19342',
          'line-width': 3,
          'line-dasharray': [1, 1.5],
        },
      });
      map.addLayer?.({
        id: 'draw-fill',
        type: 'fill',
        source: 'draw',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#f19342',
          'fill-opacity': 0.2,
        },
      });
      map.addLayer?.({
        id: 'draw-points',
        type: 'circle',
        source: 'draw',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#f19342',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }
    const src = map.getSource('draw');
    if (!src) return;
    const coordsLngLat = drawPoints.map((p) => [p.lng, p.lat]);
    const features: unknown[] = drawPoints.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { idx: i },
    }));
    if (drawPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates:
            drawPoints.length >= 3
              ? [...coordsLngLat, coordsLngLat[0]]
              : coordsLngLat,
        },
        properties: {},
      });
    }
    if (drawPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...coordsLngLat, coordsLngLat[0]]],
        },
        properties: {},
      });
    }
    src.setData({ type: 'FeatureCollection', features });
  }, [drawPoints]);

  // Update selection highlight without re-creating the map
  useEffect(() => {
    const map = mapRef.current as unknown as {
      getSource?: (id: string) => { setData: (d: unknown) => void } | undefined;
    } | null;
    if (!map?.getSource) return;
    const src = map.getSource('parcels');
    if (!src) return;
    const features = candidates.map((c, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: { idx: i, chiban: c.chiban, selected: i === selectedIdx },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [c.ring.map((p) => [p.lng, p.lat])],
      },
    }));
    src.setData({ type: 'FeatureCollection', features });
  }, [candidates, selectedIdx]);

  if (lat === null || lng === null) {
    return (
      <div
        className="relative overflow-hidden rounded-lg"
        style={{
          height,
          background:
            'linear-gradient(135deg, var(--volans-surface-alt) 0%, var(--volans-surface) 100%)',
          border: `1px solid var(--volans-border)`,
        }}
      >
        {/* subtle grid backdrop */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 220"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <defs>
            <pattern id="volans-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--volans-border)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="400" height="220" fill="url(#volans-map-grid)" />
          {/* sample parcel silhouette + road */}
          <g opacity="0.35">
            <polygon
              points="160,80 240,75 250,145 170,150"
              fill="var(--volans-primary-soft)"
              stroke="var(--volans-primary)"
              strokeWidth="1"
            />
            <line x1="0" y1="170" x2="400" y2="165" stroke="var(--volans-border-strong)" strokeWidth="6" strokeLinecap="round" />
          </g>
          {/* compass */}
          <g transform="translate(360,30)" opacity="0.5">
            <circle r="14" fill="none" stroke="var(--volans-border-strong)" strokeWidth="1" />
            <polygon points="0,-10 3,0 0,10 -3,0" fill="var(--volans-primary)" />
            <text y="-16" textAnchor="middle" fontSize="8" fill="var(--volans-muted)">
              N
            </text>
          </g>
        </svg>
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
          <div className="text-[12px] font-medium" style={{ color: 'var(--volans-text)' }}>
            住所を入力すると地図が表示されます
          </div>
          <div className="text-[10px]" style={{ color: 'var(--volans-muted)' }}>
            上の検索ボックスに住所・地番を入力 → 検索
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid var(--volans-border)`,
      }}
    >
      <div ref={containerRef} style={{ height }} />

      {/* Helper banner — tells users what they can actually do on the map. */}
      <div
        className="pointer-events-none absolute left-2 right-2 top-2 rounded-md px-3 py-1.5 text-[11px]"
        style={{
          background: 'rgba(255,255,255,0.95)',
          border: `1px solid ${drawMode ? 'var(--volans-warning)' : 'var(--volans-border-strong)'}`,
          color: 'var(--volans-text)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {drawMode ? (
          <span>
            🖋 <strong>描画モード</strong> — 地図をタップで頂点追加
            {drawPoints.length > 0 && (
              <span className="ml-1" style={{ color: 'var(--volans-warning)' }}>
                （現在 {drawPoints.length} 点）
              </span>
            )}
          </span>
        ) : candidates.length === 0 ? (
          <span>
            🖋 右下の <strong>描画モード</strong> で敷地の輪郭をなぞってください
          </span>
        ) : (
          <span>
            🖱 筆界候補 <strong>{candidates.length}</strong> 件 — 青枠タップで選択
            {selectedIdx >= 0 && (
              <span className="ml-1" style={{ color: 'var(--volans-success)' }}>
                （選択中: {candidates[selectedIdx]?.chiban ?? '—'}）
              </span>
            )}
          </span>
        )}
      </div>

      {/* Draw-mode controls (floating, bottom-right) */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
        {!drawMode ? (
          <button
            type="button"
            onClick={() => setDrawMode(true)}
            className="volans-btn-press flex items-center gap-1 overflow-hidden rounded-full px-3 py-1.5 text-[11px] font-medium shadow-md"
            style={{
              background: 'var(--volans-surface)',
              border: `1px solid var(--volans-border-strong)`,
              color: 'var(--volans-text)',
            }}
          >
            🖋 描画モード
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cancelDrawing}
              className="volans-btn-press rounded-full px-3 py-1.5 text-[11px] font-medium shadow-md"
              style={{
                background: 'var(--volans-surface)',
                border: `1px solid var(--volans-border-strong)`,
                color: 'var(--volans-muted)',
              }}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => setDrawPoints((prev) => prev.slice(0, -1))}
              disabled={drawPoints.length === 0}
              className="volans-btn-press rounded-full px-3 py-1.5 text-[11px] font-medium shadow-md disabled:opacity-50"
              style={{
                background: 'var(--volans-surface)',
                border: `1px solid var(--volans-border-strong)`,
                color: 'var(--volans-text)',
              }}
            >
              ↶ 1点戻す
            </button>
            <button
              type="button"
              onClick={commitDrawing}
              disabled={drawPoints.length < 3}
              className="volans-btn-press volans-btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-md disabled:opacity-50"
            >
              ✓ 確定 ({drawPoints.length})
            </button>
          </div>
        )}
      </div>

      {/* Toast — quick confirmation of map-tap action */}
      {toast && (
        <div
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5 text-[11px] font-medium text-white volans-msg-in"
          style={{
            background: 'var(--volans-text)',
            boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
