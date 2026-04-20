'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { MapPin, X, Check } from 'lucide-react';
import type { ParcelCandidate } from './address-search-helpers';

interface ParcelMapProps {
  lat: number;
  lng: number;
  candidates: ParcelCandidate[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ParcelMap({
  lat,
  lng,
  candidates,
  selectedIndex,
  onSelect,
  onConfirm,
  onCancel,
  isLoading = false,
}: ParcelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // MapLibre 初期化
  useEffect(() => {
    if (!mapContainer.current) return;
    let mounted = true;

    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;

        if (!mounted || !mapContainer.current) return;

        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
            sources: {
              base: {
                type: 'raster',
                // CartoDB Positron (CORS-enabled OSM-derived tiles). The
                // openstreetmap.org CDN blocks fetch() cross-origin and
                // breaks MapLibre's async tile pipeline.
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
          zoom: 17,
          maxZoom: 19,
        });

        new maplibregl.Marker({ color: '#ef4444' }).setLngLat([lng, lat]).addTo(map);

        map.on('load', () => {
          if (!mounted) return;
          mapRef.current = map;
          setMapReady(true);
        });

        return () => {
          mounted = false;
          map.remove();
          mapRef.current = null;
        };
      } catch {
        if (mounted) setMapError('地図を読み込めませんでした');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [lat, lng]);

  // 候補パーセルをGeoJSONで描画
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const SOURCE_ID = 'parcels';
    const FILL_LAYER = 'parcel-fill';
    const LINE_LAYER = 'parcel-outline';
    const SELECTED_SOURCE = 'selected-parcel';
    const SELECTED_FILL = 'selected-fill';
    const SELECTED_LINE = 'selected-line';

    // 全候補をGeoJSONで追加
    const features = candidates.map((c, i) => ({
      type: 'Feature' as const,
      properties: { index: i, selected: i === selectedIndex },
      geometry: {
        type: 'Polygon' as const,
        coordinates: c.coordinates as [number, number][][],
      },
    }));

    const geojson = { type: 'FeatureCollection' as const, features };

    if (map.getSource(SOURCE_ID)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map.getSource(SOURCE_ID) as any).setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: { 'fill-color': '#10b981', 'fill-opacity': 0.08 },
      });
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#10b981', 'line-width': 1, 'line-opacity': 0.5 },
      });
    }

    // 選択中のパーセルをハイライト
    const selected = candidates[selectedIndex];
    if (selected) {
      const selectedFeature = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: selected.coordinates as [number, number][][],
        },
      };

      if (map.getSource(SELECTED_SOURCE)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map.getSource(SELECTED_SOURCE) as any).setData(selectedFeature);
      } else {
        map.addSource(SELECTED_SOURCE, { type: 'geojson', data: selectedFeature });
        map.addLayer({
          id: SELECTED_FILL,
          type: 'fill',
          source: SELECTED_SOURCE,
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.25 },
        });
        map.addLayer({
          id: SELECTED_LINE,
          type: 'line',
          source: SELECTED_SOURCE,
          paint: { 'line-color': '#3b82f6', 'line-width': 2.5 },
        });
      }
    }
  }, [candidates, selectedIndex, mapReady]);

  const handleMapClick = useCallback(() => {
    // クリックによる選択は今後の拡張ポイント
    // 現在はドロップダウン選択で対応
  }, []);

  if (mapError) {
    return (
      <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2">
        <p className="text-xs text-amber-300">{mapError}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-xs"
          onClick={onCancel}
        >
          閉じる
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 地図 */}
      <div className="relative">
        <div
          ref={mapContainer}
          className="h-52 w-full rounded-lg border border-border overflow-hidden"
          onClick={handleMapClick}
        />
        {!mapReady && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-4 w-4 animate-pulse text-primary" />
              地図を読み込み中...
            </div>
          </div>
        )}
      </div>

      {/* 候補選択 */}
      {candidates.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {candidates.map((p, i) => (
            <button
              key={`${p.chiban}-${i}`}
              onClick={() => onSelect(i)}
              disabled={isLoading}
              className={[
                'rounded-full border px-2.5 py-1 text-[10px] transition-colors whitespace-nowrap',
                i === selectedIndex
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
              ].join(' ')}
            >
              {p.containsPoint ? '候補 ' : '近傍 '}地番:{p.chiban}
              {typeof p.distanceMeters === 'number' ? ` (${Math.round(p.distanceMeters)}m)` : ''}
            </button>
          ))}
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={onConfirm}
          disabled={selectedIndex < 0 || isLoading}
        >
          <Check className="h-3 w-3 mr-1" />
          この敷地を使用
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          <X className="h-3 w-3 mr-1" />
          閉じる
        </Button>
      </div>
    </div>
  );
}
