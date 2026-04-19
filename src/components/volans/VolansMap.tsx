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
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm-tiles', type: 'raster', source: 'osm' }],
        },
        center: [lng, lat],
        zoom: 17.5,
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
        className="grid place-items-center rounded-lg text-[11px]"
        style={{
          height,
          background: 'var(--volans-surface-alt)',
          border: `1px solid var(--volans-border)`,
          color: 'var(--volans-muted)',
        }}
      >
        住所検索で地図を読み込みます
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
