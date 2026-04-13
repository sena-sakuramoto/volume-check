'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinSimple } from '@phosphor-icons/react';
import { Check, X } from 'lucide-react';
import { Protocol } from 'pmtiles';
import { Button } from '@/components/ui/shadcn/button';

const AMX_PMTILES_URL = 'https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles';
const AMX_SOURCE_ID = 'amx-parcels';
const AMX_FILL_LAYER_ID = 'amx-parcels-fill';
const AMX_LINE_LAYER_ID = 'amx-parcels-line';
const SELECTED_SOURCE_ID = 'selected-parcel';
const SELECTED_FILL_LAYER_ID = 'selected-parcel-fill';
const SELECTED_LINE_LAYER_ID = 'selected-parcel-line';

interface ParcelMapProps {
  lat: number;
  lng: number;
  onParcelSelect(coordinates: [number, number][][], properties: Record<string, unknown>): void;
  onCancel(): void;
}

interface ParcelCandidate {
  chiban?: string;
  oaza?: string;
  chome?: string;
  koaza?: string;
  coordinates: [number, number][][];
  containsPoint: boolean;
  properties: Record<string, unknown>;
}

interface ParcelLookupResponse {
  parcels?: ParcelCandidate[];
  message?: string;
  error?: string;
}

interface PolygonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: 'Polygon';
      coordinates: [number, number][][];
    };
  }>;
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function buildFeatureCollection(parcel: ParcelCandidate | null): PolygonFeatureCollection {
  if (!parcel) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: parcel.properties,
        geometry: {
          type: 'Polygon',
          coordinates: parcel.coordinates.map((ring) => closeRing(ring)),
        },
      },
    ],
  };
}

function getBounds(parcels: ParcelCandidate[]): [[number, number], [number, number]] | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const parcel of parcels) {
    for (const ring of parcel.coordinates) {
      for (const [coordLng, coordLat] of ring) {
        minLng = Math.min(minLng, coordLng);
        minLat = Math.min(minLat, coordLat);
        maxLng = Math.max(maxLng, coordLng);
        maxLat = Math.max(maxLat, coordLat);
      }
    }
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) {
    return null;
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}

function getParcelLabel(parcel: ParcelCandidate, index: number): string {
  const parts = [parcel.oaza, parcel.chome, parcel.koaza, parcel.chiban]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(' ');
  }

  return `候補 ${index + 1}`;
}

function getThemeColor(variableName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  return value ? `hsl(${value})` : fallback;
}

export function ParcelMap({ lat, lng, onParcelSelect, onCancel }: ParcelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [parcels, setParcels] = useState<ParcelCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const selectedParcel = useMemo(
    () => parcels[selectedIndex] ?? parcels.find((parcel) => parcel.containsPoint) ?? null,
    [parcels, selectedIndex],
  );

  useEffect(() => {
    let ignore = false;

    async function loadParcels() {
      setStatus('loading');
      setMessage('');
      setParcels([]);
      setSelectedIndex(0);

      try {
        const response = await fetch('/api/parcel-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });

        const data = (await response.json().catch(() => ({}))) as ParcelLookupResponse;
        if (ignore) return;

        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'パーセル検索に失敗しました。手動入力をご利用ください。');
          return;
        }

        const nextParcels = Array.isArray(data.parcels) ? data.parcels : [];
        if (nextParcels.length === 0) {
          setStatus('empty');
          setMessage(data.message || 'この地点の筆界データが見つかりませんでした。');
          return;
        }

        setParcels(nextParcels);
        setSelectedIndex(Math.max(nextParcels.findIndex((parcel) => parcel.containsPoint), 0));
        setStatus('ready');
      } catch {
        if (ignore) return;
        setStatus('error');
        setMessage('パーセル検索に失敗しました。手動入力をご利用ください。');
      }
    }

    void loadParcels();

    return () => {
      ignore = true;
    };
  }, [lat, lng]);

  useEffect(() => {
    let disposed = false;

    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return;

      try {
        // @ts-expect-error Next.js does not ship a declaration for the runtime-only CSS import.
        await import('maplibre-gl/dist/maplibre-gl.css');
        const maplibregl = await import('maplibre-gl');
        if (disposed || !mapContainerRef.current) return;

        const protocol = new Protocol();
        try {
          maplibregl.addProtocol('pmtiles', protocol.tile);
        } catch {
          // Ignore duplicate protocol registration when the component remounts.
        }

        const primaryColor = getThemeColor('--primary', 'hsl(221.2 83.2% 53.3%)');
        const borderColor = getThemeColor('--border', 'hsl(214.3 31.8% 91.4%)');
        const mutedColor = getThemeColor('--muted-foreground', 'hsl(215.4 16.3% 46.9%)');

        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          center: [lng, lat],
          zoom: 17,
          attributionControl: {},
          style: {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'osm',
                type: 'raster',
                source: 'osm',
              },
            ],
          },
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          if (!map.getSource(AMX_SOURCE_ID)) {
            map.addSource(AMX_SOURCE_ID, {
              type: 'vector',
              url: `pmtiles://${AMX_PMTILES_URL}`,
            });
          }

          if (!map.getLayer(AMX_FILL_LAYER_ID)) {
            map.addLayer({
              id: AMX_FILL_LAYER_ID,
              type: 'fill',
              source: AMX_SOURCE_ID,
              'source-layer': 'fude',
              paint: {
                'fill-color': borderColor,
                'fill-opacity': 0.08,
              },
            });
          }

          if (!map.getLayer(AMX_LINE_LAYER_ID)) {
            map.addLayer({
              id: AMX_LINE_LAYER_ID,
              type: 'line',
              source: AMX_SOURCE_ID,
              'source-layer': 'fude',
              paint: {
                'line-color': mutedColor,
                'line-width': 1,
                'line-opacity': 0.55,
              },
            });
          }

          if (!map.getSource(SELECTED_SOURCE_ID)) {
            map.addSource(SELECTED_SOURCE_ID, {
              type: 'geojson',
              data: buildFeatureCollection(null),
            });
          }

          if (!map.getLayer(SELECTED_FILL_LAYER_ID)) {
            map.addLayer({
              id: SELECTED_FILL_LAYER_ID,
              type: 'fill',
              source: SELECTED_SOURCE_ID,
              paint: {
                'fill-color': primaryColor,
                'fill-opacity': 0.32,
              },
            });
          }

          if (!map.getLayer(SELECTED_LINE_LAYER_ID)) {
            map.addLayer({
              id: SELECTED_LINE_LAYER_ID,
              type: 'line',
              source: SELECTED_SOURCE_ID,
              paint: {
                'line-color': primaryColor,
                'line-width': 3,
              },
            });
          }

          setMapReady(true);
        });

        mapRef.current = map;
      } catch {
        if (!disposed) {
          setStatus((currentStatus) => (currentStatus === 'ready' ? 'ready' : 'error'));
          setMessage((currentMessage) =>
            currentMessage || '地図の読み込みに失敗しました。手動入力をご利用ください。',
          );
        }
      }
    }

    void initMap();

    return () => {
      disposed = true;
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(SELECTED_SOURCE_ID) as import('maplibre-gl').GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildFeatureCollection(selectedParcel));

    const bounds = getBounds(selectedParcel ? [selectedParcel] : parcels);
    if (bounds) {
      map.fitBounds(bounds, { padding: 32, duration: 0, maxZoom: 19 });
      return;
    }

    map.easeTo({ center: [lng, lat], zoom: 17, duration: 0 });
  }, [lat, lng, mapReady, parcels, selectedParcel]);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-full bg-primary/10 p-1.5 text-primary">
            <MapPinSimple className="h-4 w-4" weight="duotone" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">敷地候補を選択</p>
            <p className="text-[11px] text-muted-foreground">
              地図と候補一覧から筆界を選び、敷地形状として取り込みます。
            </p>
          </div>
        </div>
      </div>

      {status === 'loading' && (
        <div className="rounded-md border border-border bg-secondary/30 px-3 py-4 text-[11px] text-muted-foreground">
          敷地候補を読み込んでいます...
        </div>
      )}

      {status !== 'loading' && (
        <>
          <div ref={mapContainerRef} className="h-56 overflow-hidden rounded-md border border-border bg-secondary/20" />

          {status === 'ready' && parcels.length > 0 && (
            <div className="space-y-2">
              <div className="grid gap-2">
                {parcels.map((parcel, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={`${getParcelLabel(parcel, index)}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={[
                        'flex w-full items-start justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary/40',
                      ].join(' ')}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{getParcelLabel(parcel, index)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {parcel.containsPoint ? '検索地点を含む候補' : '近接する筆界候補'}
                        </p>
                      </div>
                      {isSelected && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => selectedParcel && onParcelSelect(selectedParcel.coordinates, selectedParcel.properties)}
                  disabled={!selectedParcel}
                >
                  <Check className="h-4 w-4" />
                  この敷地を使用
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  <X className="h-4 w-4" />
                  手動入力
                </Button>
              </div>
            </div>
          )}

          {(status === 'empty' || status === 'error') && (
            <div className="space-y-3 rounded-md border border-border bg-secondary/30 px-3 py-3">
              <p className="text-[11px] text-foreground">{message}</p>
              <p className="text-[11px] text-muted-foreground">
                筆界データが取得できない場合は、下のボタンから敷地形状を手動で入力してください。
              </p>
              <Button size="sm" variant="outline" onClick={onCancel}>
                <X className="h-4 w-4" />
                手動入力
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
