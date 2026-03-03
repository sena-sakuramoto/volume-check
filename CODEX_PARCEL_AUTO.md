# CODEX_PARCEL_AUTO: 敷地形状の自動取得（AMX PMTiles + PLATEAU道路検出）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 住所を入れて地図上で筆界をクリック → 敷地形状 + 接道道路が自動で設定される

**Architecture:** AMX Project の PMTiles（法務省登記所備付地図ベース）で筆界ポリゴンを地図表示。MapLibre GL JS でクリック選択。選択後、PLATEAU tran MVT から接道道路を自動検出。既存の AddressSearch フローに統合。

**Tech Stack:** MapLibre GL JS, pmtiles, @mapbox/vector-tile (既存), pbf (既存)

**UI設計はCLAUDE.mdの「UI設計原則（全プロダクト共通）」12原則に従うこと。特に原則1（選択肢 > 自由入力）と原則2（AI出力にアクションボタン）を厳守。デザイン禁止事項（AIグラデーション、Inter、Lucideのみ、shadcnデフォルト）を遵守。**

---

## 前提知識

### AMX PMTiles
- URL: `https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles`
- レイヤー `fude`（z14-16）: 筆界ポリゴン。属性: 市区町村コード, 市区町村名, 大字名, 丁目名, 小字名, 地番, 精度区分
- レイヤー `daihyo`（z2-13）: 代表点、属性なし
- 東京都心部はカバー率が不完全（任意座標系データは位置情報なし）

### PLATEAU 道路 (tran) MVT
- 東京都全域: datacatalog API からURL取得
- 道路ポリゴンを敷地ポリゴンと空間比較して接道を検出

### 既存コード
- `src/app/api/zoning-lookup/route.ts` — MVTタイル解析の基盤（latLngToTile, pointInPolygon等）。再利用する。
- `src/components/site/AddressSearch.tsx` — geocode + zoning-lookup + site-shape-lookup を呼んでいる。ここにパーセル選択を追加。
- `src/components/sidebar/SiteSection.tsx` — AddressSearch, FileUpload, SiteEditor, RoadEditor を組み合わせ。
- `package.json` に `@mapbox/vector-tile` と `pbf` は既存。`pmtiles` と `maplibre-gl` を追加する。

---

## Task 1: パッケージ追加と共通MVTユーティリティの抽出

**Files:**
- Modify: `package.json`
- Create: `src/lib/mvt-utils.ts`
- Create: `src/lib/__tests__/mvt-utils.test.ts`
- Modify: `src/app/api/zoning-lookup/route.ts` (共通関数を外出し)

### Step 1: パッケージ追加

```bash
pnpm add pmtiles maplibre-gl
pnpm add -D @types/maplibre-gl
```

> Note: `@types/maplibre-gl` が存在しない場合はスキップ。maplibre-gl は自前の型定義を持つ。

### Step 2: 共通MVTユーティリティを抽出

`src/app/api/zoning-lookup/route.ts` から以下の関数を `src/lib/mvt-utils.ts` に移動:
- `latLngToTile(lat, lng, z)` → タイル座標計算
- `latLngToPixel(lat, lng, z, tileX, tileY, extent)` → ピクセル座標計算
- `pointInPolygon(px, py, ring)` → レイキャスティング
- `pointInFeatureGeometry(px, py, feature)` → フィーチャー内判定
- `signedArea(ring)` → 符号付き面積

```typescript
// src/lib/mvt-utils.ts
export function latLngToTile(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const tileX = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { tileX, tileY };
}

export function latLngToPixel(
  lat: number, lng: number, z: number,
  tileX: number, tileY: number, extent: number
) {
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const pixelX = ((lng + 180) / 360 * n - tileX) * extent;
  const pixelY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n - tileY) * extent;
  return { pixelX, pixelY };
}

interface TilePoint { x: number; y: number; }

export function pointInPolygon(px: number, py: number, ring: TilePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y;
    const xj = ring[j].x, yj = ring[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function signedArea(ring: TilePoint[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  }
  return sum;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pointInFeatureGeometry(px: number, py: number, feature: any): boolean {
  const geomType = feature.type;
  const geometry: TilePoint[][] = feature.loadGeometry();

  if (geomType === 3) {
    let insideOuter = false;
    let insideHole = false;
    for (const ring of geometry) {
      const area = signedArea(ring);
      if (area > 0) {
        if (insideOuter && !insideHole) return true;
        insideOuter = pointInPolygon(px, py, ring);
        insideHole = false;
      } else {
        if (insideOuter && pointInPolygon(px, py, ring)) insideHole = true;
      }
    }
    return insideOuter && !insideHole;
  }

  if (geomType === 1) {
    for (const ring of geometry) {
      for (const pt of ring) {
        const dx = pt.x - px, dy = pt.y - py;
        if (dx * dx + dy * dy < 100) return true;
      }
    }
  }
  return false;
}

/**
 * MVTタイルをフェッチしてVectorTileとして返す。
 * タイムアウト15秒。失敗時はnullを返す。
 */
export async function fetchMvtTile(
  urlTemplate: string, z: number, x: number, y: number
): Promise<import('@mapbox/vector-tile').VectorTile | null> {
  const Pbf = (await import('pbf')).default;
  const { VectorTile } = await import('@mapbox/vector-tile');

  const url = urlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new VectorTile(new Pbf(new Uint8Array(buf)));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * MVTフィーチャーのジオメトリ（タイル座標）をWGS84緯度経度に変換。
 * 返り値: [lng, lat][] のリング配列
 */
export function featureGeometryToLatLng(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any,
  z: number,
  tileX: number,
  tileY: number
): [number, number][][] {
  const geometry: TilePoint[][] = feature.loadGeometry();
  const extent = feature.extent;
  const n = Math.pow(2, z);

  return geometry.map(ring =>
    ring.map(pt => {
      const lng = ((tileX + pt.x / extent) / n) * 360 - 180;
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + pt.y / extent) / n)));
      const lat = (latRad * 180) / Math.PI;
      return [lng, lat] as [number, number];
    })
  );
}

/**
 * [lng, lat][] の配列を Point2D[] (メートル座標) に変換。
 * 基準点(refLat, refLng)からの相対メートル座標。
 */
export function lngLatToMeters(
  coords: [number, number][],
  refLat: number,
  refLng: number
): { x: number; y: number }[] {
  const R = 6371000;
  const latRad = (refLat * Math.PI) / 180;
  return coords.map(([lng, lat]) => ({
    x: ((lng - refLng) * Math.PI / 180) * R * Math.cos(latRad),
    y: ((lat - refLat) * Math.PI / 180) * R,
  }));
}
```

### Step 3: テスト作成

```typescript
// src/lib/__tests__/mvt-utils.test.ts
import { latLngToTile, latLngToPixel, pointInPolygon, lngLatToMeters } from '../mvt-utils';

describe('latLngToTile', () => {
  test('東京駅をz14でタイル計算', () => {
    const { tileX, tileY } = latLngToTile(35.6812, 139.7671, 14);
    expect(tileX).toBe(14552);
    expect(tileY).toBe(6451);
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { x: 100, y: 100 }, { x: 0, y: 100 },
  ];
  test('内部の点', () => expect(pointInPolygon(50, 50, square)).toBe(true));
  test('外部の点', () => expect(pointInPolygon(150, 50, square)).toBe(false));
});

describe('lngLatToMeters', () => {
  test('同一点は原点', () => {
    const result = lngLatToMeters([[139.7671, 35.6812]], 35.6812, 139.7671);
    expect(result[0].x).toBeCloseTo(0, 0);
    expect(result[0].y).toBeCloseTo(0, 0);
  });
});
```

### Step 4: テスト実行

```bash
pnpm test -- --testPathPattern="mvt-utils" --verbose
```
Expected: PASS

### Step 5: zoning-lookup/route.ts を共通ユーティリティに差し替え

`src/app/api/zoning-lookup/route.ts` の先頭で:
```typescript
import { latLngToTile, latLngToPixel, pointInPolygon, pointInFeatureGeometry, signedArea, fetchMvtTile } from '@/lib/mvt-utils';
```
ローカル定義の同名関数を削除。動作は完全に同一のまま。

### Step 6: ビルド確認

```bash
pnpm build
```
Expected: ビルド成功

### Step 7: コミット

```bash
git add src/lib/mvt-utils.ts src/lib/__tests__/mvt-utils.test.ts src/app/api/zoning-lookup/route.ts package.json pnpm-lock.yaml
git commit -m "refactor: extract MVT utilities + add pmtiles/maplibre-gl deps"
```

---

## Task 2: パーセル検索APIの作成

**Files:**
- Create: `src/app/api/parcel-lookup/route.ts`

### Step 1: API実装

POST `{ lat, lng }` → 近傍の筆界ポリゴン候補を返す。

```typescript
// src/app/api/parcel-lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  latLngToTile, latLngToPixel, pointInFeatureGeometry,
  featureGeometryToLatLng, fetchMvtTile,
} from '@/lib/mvt-utils';

// AMX PMTiles は直接MVTタイルとして参照できないため、
// PMTiles プロトコルはクライアントサイドで使用する。
// サーバーサイドでは pmtiles パッケージで直接読む。

import { PMTiles } from 'pmtiles';

const AMX_PMTILES_URL = 'https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles';

let pmtilesInstance: PMTiles | null = null;
function getPMTiles() {
  if (!pmtilesInstance) {
    pmtilesInstance = new PMTiles(AMX_PMTILES_URL);
  }
  return pmtilesInstance;
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lng } = await req.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: '緯度(lat)と経度(lng)を数値で指定してください' }, { status: 400 });
    }

    const z = 15; // fude レイヤーは z14-16
    const { tileX, tileY } = latLngToTile(lat, lng, z);

    // PMTiles からタイルデータ取得
    const pm = getPMTiles();
    const tileData = await pm.getZxy(z, tileX, tileY);

    if (!tileData || !tileData.data || tileData.data.byteLength === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の筆界データがありません。手動入力をご利用ください。',
      });
    }

    const Pbf = (await import('pbf')).default;
    const { VectorTile } = await import('@mapbox/vector-tile');
    const tile = new VectorTile(new Pbf(new Uint8Array(tileData.data)));

    const fudeLayer = tile.layers['fude'];
    if (!fudeLayer || fudeLayer.length === 0) {
      return NextResponse.json({
        parcels: [],
        message: 'この地点の筆界データがありません。',
      });
    }

    const extent = fudeLayer.feature(0).extent;
    const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);

    // 検索対象: クリック地点を含むフィーチャー + 近傍のフィーチャー
    interface ParcelCandidate {
      properties: Record<string, unknown>;
      coordinates: [number, number][][]; // [lng, lat] rings
      containsPoint: boolean;
    }

    const candidates: ParcelCandidate[] = [];

    for (let i = 0; i < fudeLayer.length; i++) {
      const feature = fudeLayer.feature(i);
      const contains = pointInFeatureGeometry(pixelX, pixelY, feature);

      if (contains || candidates.length < 10) {
        const coords = featureGeometryToLatLng(feature, z, tileX, tileY);
        candidates.push({
          properties: feature.properties as Record<string, unknown>,
          coordinates: coords,
          containsPoint: contains,
        });
      }

      // クリック地点を含むフィーチャーが見つかったら、さらに隣接を探す必要はあるが
      // まず含む区画を返すことを優先
      if (contains && candidates.length >= 5) break;
    }

    // 含むものを先頭に
    candidates.sort((a, b) => (b.containsPoint ? 1 : 0) - (a.containsPoint ? 1 : 0));

    return NextResponse.json({
      parcels: candidates.slice(0, 10).map(c => ({
        chiban: c.properties['地番'] ?? c.properties['chiban'] ?? '不明',
        oaza: c.properties['大字名'] ?? '',
        chome: c.properties['丁目名'] ?? '',
        koaza: c.properties['小字名'] ?? '',
        coordinates: c.coordinates,
        containsPoint: c.containsPoint,
        properties: c.properties,
      })),
    });
  } catch (error) {
    console.error('[parcel-lookup] Error:', error);
    return NextResponse.json({ error: 'パーセル検索に失敗しました' }, { status: 500 });
  }
}
```

### Step 2: ビルド確認

```bash
pnpm build
```

### Step 3: コミット

```bash
git add src/app/api/parcel-lookup/route.ts
git commit -m "feat: add parcel-lookup API using AMX PMTiles"
```

---

## Task 3: MapLibreパーセル選択コンポーネント

**Files:**
- Create: `src/components/site/ParcelMap.tsx`

### Step 1: 実装

```tsx
// src/components/site/ParcelMap.tsx
'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { MapPin, X, Check } from 'lucide-react';

interface ParcelData {
  chiban: string;
  oaza: string;
  chome: string;
  koaza: string;
  coordinates: [number, number][][];
  containsPoint: boolean;
  properties: Record<string, unknown>;
}

interface ParcelMapProps {
  lat: number;
  lng: number;
  onParcelSelect: (coordinates: [number, number][][], properties: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function ParcelMap({ lat, lng, onParcelSelect, onCancel }: ParcelMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [parcels, setParcels] = useState<ParcelData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // パーセルデータ取得
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/parcel-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
        const data = await res.json();
        if (data.parcels && data.parcels.length > 0) {
          setParcels(data.parcels);
          // 自動選択: containsPoint が true のもの
          const autoIdx = data.parcels.findIndex((p: ParcelData) => p.containsPoint);
          if (autoIdx >= 0) setSelectedIdx(autoIdx);
        } else {
          setError(data.message || '筆界データが見つかりません');
        }
      } catch {
        setError('筆界データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [lat, lng]);

  // MapLibre 初期化
  useEffect(() => {
    if (!mapContainer.current) return;

    let mounted = true;

    (async () => {
      const maplibregl = await import('maplibre-gl');
      await import('maplibre-gl/dist/maplibre-gl.css');
      const { Protocol } = await import('pmtiles');

      // PMTiles プロトコル登録（一度だけ）
      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);

      if (!mounted || !mapContainer.current) return;

      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
            'amx': {
              type: 'vector',
              url: 'pmtiles://https://habs.rad.naro.go.jp/spatial_data/amx/a.pmtiles',
            },
          },
          layers: [
            { id: 'osm-tiles', type: 'raster', source: 'osm' },
            {
              id: 'parcel-fill',
              type: 'fill',
              source: 'amx',
              'source-layer': 'fude',
              minzoom: 14,
              paint: {
                'fill-color': '#10b981',
                'fill-opacity': 0.1,
              },
            },
            {
              id: 'parcel-outline',
              type: 'line',
              source: 'amx',
              'source-layer': 'fude',
              minzoom: 14,
              paint: {
                'line-color': '#10b981',
                'line-width': 1,
                'line-opacity': 0.6,
              },
            },
          ],
        },
        center: [lng, lat],
        zoom: 17,
      });

      // ピンマーカー
      new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([lng, lat])
        .addTo(map);

      mapRef.current = map;
    })();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  // 選択中のパーセルをハイライト
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedIdx === null || !parcels[selectedIdx]) return;

    const coords = parcels[selectedIdx].coordinates;
    if (!coords || coords.length === 0) return;

    // GeoJSON ソースで選択パーセルを表示
    const geojson: GeoJSON.Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: coords,
      },
    };

    const sourceId = 'selected-parcel';

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.on('load', () => {
        if (map.getSource(sourceId)) return;
        map.addSource(sourceId, { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'selected-parcel-fill',
          type: 'fill',
          source: sourceId,
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.3 },
        });
        map.addLayer({
          id: 'selected-parcel-outline',
          type: 'line',
          source: sourceId,
          paint: { 'line-color': '#3b82f6', 'line-width': 3 },
        });
      });
    }
  }, [selectedIdx, parcels]);

  const handleConfirm = useCallback(() => {
    if (selectedIdx !== null && parcels[selectedIdx]) {
      onParcelSelect(parcels[selectedIdx].coordinates, parcels[selectedIdx].properties);
    }
  }, [selectedIdx, parcels, onParcelSelect]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-4 w-4 animate-pulse" />
          筆界データを取得中...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3">
        <p className="text-xs text-amber-300">{error}</p>
        <p className="text-[10px] text-amber-400/70 mt-1">下の手動入力で敷地形状を設定してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 地図 */}
      <div ref={mapContainer} className="h-56 rounded-lg border border-border overflow-hidden" />

      {/* パーセルリスト（選択肢 > 自由入力 原則） */}
      {parcels.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground">敷地を選択してください</p>
          <div className="flex flex-wrap gap-1">
            {parcels.filter(p => p.containsPoint || parcels.length <= 5).map((p, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  selectedIdx === i
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                {p.oaza}{p.chome} {p.chiban}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={handleConfirm}
          disabled={selectedIdx === null}
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
          手動入力
        </Button>
      </div>
    </div>
  );
}
```

### Step 2: ビルド確認

```bash
pnpm build
```

### Step 3: コミット

```bash
git add src/components/site/ParcelMap.tsx
git commit -m "feat: add ParcelMap component with MapLibre + AMX PMTiles"
```

---

## Task 4: AddressSearch にパーセル選択フローを統合

**Files:**
- Modify: `src/components/site/AddressSearch.tsx`
- Modify: `src/lib/mvt-utils.ts` (lngLatToMeters を使って座標変換)

### Step 1: AddressSearch を修正

geocode 成功後に ParcelMap を表示する。パーセル選択時に座標変換して SiteBoundary を生成。

AddressSearch に以下の状態を追加:
- `parcelSelectMode: boolean` — true の時 ParcelMap を表示
- `geocodedLatLng: {lat, lng} | null`

フロー:
1. 住所入力 → geocode
2. geocode 成功 → `parcelSelectMode = true` + ParcelMap 表示
3. パーセル選択 → `lngLatToMeters` で Point2D[] 変換 → `onSiteChange` 呼び出し
4. 同時に zoning-lookup も実行（既存フロー）

```tsx
// AddressSearch.tsx の変更点

import { ParcelMap } from './ParcelMap';
import { lngLatToMeters } from '@/lib/mvt-utils';

// state追加
const [parcelMode, setParcelMode] = useState(false);
const [geocodedPos, setGeocodedPos] = useState<{ lat: number; lng: number } | null>(null);

// geocode成功時（既存の handleSearch 内）:
// latLngRef.current = { lat, lng } の後に:
setGeocodedPos({ lat, lng });
setParcelMode(true);

// パーセル選択コールバック
const handleParcelSelect = useCallback(
  (coordinates: [number, number][][], properties: Record<string, unknown>) => {
    if (!geocodedPos) return;
    const outerRing = coordinates[0]; // 外周リング [lng, lat][]
    if (!outerRing || outerRing.length < 3) return;

    const vertices = lngLatToMeters(outerRing, geocodedPos.lat, geocodedPos.lng);

    // 面積計算（Shoelace formula）
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      area += vertices[i].x * vertices[j].y;
      area -= vertices[j].x * vertices[i].y;
    }
    area = Math.abs(area) / 2;

    onSiteChange({ vertices, area });
    setParcelMode(false);
  },
  [geocodedPos, onSiteChange]
);

// JSX: searchStatus成功後にParcelMapを表示
{parcelMode && geocodedPos && (
  <ParcelMap
    lat={geocodedPos.lat}
    lng={geocodedPos.lng}
    onParcelSelect={handleParcelSelect}
    onCancel={() => setParcelMode(false)}
  />
)}
```

### Step 2: ビルド確認

```bash
pnpm build
```

### Step 3: コミット

```bash
git add src/components/site/AddressSearch.tsx
git commit -m "feat: integrate ParcelMap into AddressSearch flow"
```

---

## Task 5: PLATEAU道路検出API

**Files:**
- Create: `src/app/api/road-detect/route.ts`

### Step 1: API実装

POST `{ lat, lng, siteVertices: [lng,lat][] }` → 接道する道路を検出して返す。

```typescript
// src/app/api/road-detect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { latLngToTile, fetchMvtTile, featureGeometryToLatLng, lngLatToMeters } from '@/lib/mvt-utils';

// PLATEAU tran（道路）MVT — 東京都全域
// 注意: このURLはPLATEAU datacatalog APIから取得すべきだが、
// 暫定的に固定値を使用する。datacatalog APIからの動的取得は後続タスクで対応。
const PLATEAU_TRAN_URLS = [
  // Tokyo pref-wide tran が存在する場合はここに設定
  // 存在しない場合は ward 別に取得が必要
  // ひとまず空配列にして、道路検出はPLATEAU対応後に有効化
];

export async function POST(req: NextRequest) {
  try {
    const { lat, lng, siteCoordinates } = await req.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat, lng が必要です' }, { status: 400 });
    }

    if (!Array.isArray(siteCoordinates) || siteCoordinates.length < 3) {
      return NextResponse.json({ error: 'siteCoordinates が必要です' }, { status: 400 });
    }

    // TODO: PLATEAU tran MVTから道路ポリゴンを取得し、
    // 敷地ポリゴンとの接道を検出する。
    // 暫定: 空の結果を返す（既存の手動道路入力にフォールバック）

    return NextResponse.json({
      roads: [],
      message: 'PLATEAU道路データ連携は次フェーズで対応予定です。道路は手動入力してください。',
    });
  } catch (error) {
    console.error('[road-detect] Error:', error);
    return NextResponse.json({ error: '道路検出に失敗しました' }, { status: 500 });
  }
}
```

> 注意: PLATEAU tran のMVTタイルURLは ward 別で、datacatalog APIからの動的取得が必要。
> Phase 1 ではスタブAPIとして作成し、Phase 2 の PLATEAU URF 連携時にまとめて実装する。
> 道路入力は既存の RoadEditor で手動入力可能なため、Phase 1 のブロッカーにはならない。

### Step 2: コミット

```bash
git add src/app/api/road-detect/route.ts
git commit -m "feat: add road-detect API stub (PLATEAU tran integration planned)"
```

---

## Task 6: テスト + 動作確認

### Step 1: 全テスト実行

```bash
pnpm test --verbose
```
Expected: 既存テスト全PASS + 新規mvt-utilsテストPASS

### Step 2: ビルド確認

```bash
pnpm build
```
Expected: 成功

### Step 3: dev サーバーで動作確認

```bash
pnpm dev
```

手動確認項目:
1. 住所「東京都渋谷区神宮前1-1」を入力して検索
2. geocode 成功後に地図が表示されること
3. 筆界ポリゴンがオーバーレイ表示されること
4. クリックして敷地選択 → 敷地形状が設定されること
5. 「手動入力」ボタンで既存UIにフォールバックできること
6. 筆界データがないエリアで「手動入力をご利用ください」が表示されること

### Step 4: 最終コミット

```bash
git add -A
git commit -m "feat: Phase 1 complete - parcel auto-detection with AMX PMTiles"
```

---

## 完了条件

- [ ] `pnpm build` 成功
- [ ] `pnpm test` 全PASS
- [ ] 住所入力→地図表示→筆界選択→敷地形状設定 の一連フローが動作
- [ ] 筆界データなしの場合に手動入力へフォールバック
- [ ] 既存の FileUpload / SiteEditor / RoadEditor が引き続き動作
- [ ] MapLibre 地図のCSS が他のUIに干渉していない
