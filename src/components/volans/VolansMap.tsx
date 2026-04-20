'use client';

import { useEffect, useRef } from 'react';
import { useVolansStore } from '@/stores/useVolansStore';

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
              '#94a3b8',
            ],
            'fill-opacity': [
              'case',
              ['get', 'selected'],
              0.45,
              0.2,
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
              '#3b6de1',
              '#64748b',
            ],
            'line-width': [
              'case',
              ['get', 'selected'],
              2.2,
              1,
            ],
          },
        });
        map.on('click', 'parcels-fill', (e) => {
          const feat = e.features?.[0];
          if (!feat) return;
          const idx = (feat.properties as { idx?: number })?.idx;
          if (typeof idx === 'number') {
            useVolansStore.getState().selectParcel(idx);
          }
        });
        map.on('mouseenter', 'parcels-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'parcels-fill', () => {
          map.getCanvas().style.cursor = '';
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
      ref={containerRef}
      style={{
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid var(--volans-border)`,
      }}
    />
  );
}
