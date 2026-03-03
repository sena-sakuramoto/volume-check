# CODEX_PLATEAU_URF: PLATEAU urf連携（高度地区・地区計画・防火地域）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** PLATEAU の都市計画決定情報 MVT タイルから高度地区・地区計画・防火地域を自動取得し、計算エンジンに反映する

**Architecture:** 既存の zoning-lookup パターン（MVTタイル → サーバーサイド解析 → JSON応答）を踏襲。PLATEAU urf の東京都全域タイルを直接参照。ZoningData 型を拡張して districtPlan フィールドを追加。

**Tech Stack:** @mapbox/vector-tile (既存), pbf (既存), mvt-utils (Task 1で作成)

**UI設計はCLAUDE.mdの「UI設計原則（全プロダクト共通）」12原則に従うこと。特に原則1（選択肢 > 自由入力）と原則2（AI出力にアクションボタン）を厳守。デザイン禁止事項（AIグラデーション、Inter、Lucideのみ、shadcnデフォルト）を遵守。**

---

## 前提知識

### PLATEAU urf MVT タイル（東京都全域・認証不要）

| Feature Class | URL |
|--------------|-----|
| UseDistrict（用途地域） | `https://assets.cms.plateau.reearth.io/assets/5b/8d0e14-be51-4739-bf91-13cc176472c8/13_tokyo_pref_2023_citygml_1_op_urf_UseDistrict_mvt_lod1/{z}/{x}/{y}.mvt` |
| HeightControlDistrict（高度地区） | `https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt` |
| FirePreventionDistrict（防火地域） | `https://assets.cms.plateau.reearth.io/assets/d9/5ce2d6-0aa8-4a17-a86a-028c2dc2b817/13_tokyo_pref_2023_citygml_1_op_urf_FirePreventionDistrict_mvt_lod1/{z}/{x}/{y}.mvt` |

DistrictPlan（地区計画）は ward 別。datacatalog API から取得が必要。

### 属性構造
- 各フィーチャーの `attributes` プロパティに JSON 文字列が格納されている
- `JSON.parse(attributes)` して中身を参照
- UseDistrict: `floorAreaRatio`, `buildingCoverageRatio`, `function`/`districtsAndZonesType`
- HeightControlDistrict: 高さ制限パラメータ
- FirePreventionDistrict: 防火区分

### 既存コード
- `src/lib/mvt-utils.ts` — MVTタイル解析共通関数（CODEX_PARCEL_AUTO で作成）
- `src/app/api/zoning-lookup/route.ts` — Geolonia タイルから用途地域を取得
- `src/engine/types.ts` — ZoningData, HeightDistrict, FireDistrict の型定義
- `src/components/sidebar/ZoningSection.tsx` — 用途地域選択UI

---

## Task 1: ZoningData 型の拡張

**Files:**
- Modify: `src/engine/types.ts`

### Step 1: districtPlan フィールド追加

```typescript
// src/engine/types.ts の ZoningData に追加

/** 地区計画情報（ある場合） */
export interface DistrictPlanInfo {
  /** 地区計画の名称 */
  name: string;
  /** 制限内容（テキスト） */
  restrictions?: string;
  /** 最高高さ制限（m）（地区計画による上乗せ） */
  maxHeight?: number;
  /** 最低高さ制限（m） */
  minHeight?: number;
  /** 壁面後退（m）（地区計画による上乗せ） */
  wallSetback?: number;
  /** 容積率上限（地区計画による上乗せ、0-1） */
  floorAreaRatio?: number;
  /** 建ぺい率上限（地区計画による上乗せ、0-1） */
  coverageRatio?: number;
}

// ZoningData interface に追加:
export interface ZoningData {
  // ... 既存フィールド ...

  /** 地区計画（PLATEAU urf から取得、あれば） */
  districtPlan: DistrictPlanInfo | null;
}
```

### Step 2: 既存コードで districtPlan を null 初期化

`src/components/site/site-helpers.ts` の `buildZoningData` 関数に `districtPlan: null` を追加。

他に ZoningData を生成している箇所も全て `districtPlan: null` を追加:
- `src/lib/demo-data.ts`
- `src/lib/project-io.ts`（デシリアライズ時）
- テストファイル内の ZoningData 生成箇所

### Step 3: テスト実行

```bash
pnpm test --verbose
```
Expected: 全PASS（型追加のみで破壊的変更なし。ただし districtPlan がない既存データのため、オプショナルにするか null 初期化が必要）

### Step 4: ビルド確認

```bash
pnpm build
```

### Step 5: コミット

```bash
git add src/engine/types.ts src/components/site/site-helpers.ts src/lib/demo-data.ts src/lib/project-io.ts
git commit -m "feat: add DistrictPlanInfo type and districtPlan field to ZoningData"
```

---

## Task 2: PLATEAU urf 検索 API の作成

**Files:**
- Create: `src/app/api/plateau-urf-lookup/route.ts`

### Step 1: API実装

POST `{ lat, lng }` → PLATEAU urf MVT から高度地区・地区計画・防火地域を取得。

```typescript
// src/app/api/plateau-urf-lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  latLngToTile, latLngToPixel, pointInFeatureGeometry, fetchMvtTile,
} from '@/lib/mvt-utils';

// 東京都全域 PLATEAU urf MVT タイルURL
const TILE_URLS = {
  heightControl: 'https://assets.cms.plateau.reearth.io/assets/a2/81a1a7-03b8-4cf2-bb26-19103b32e255/13_tokyo_pref_2023_citygml_1_op_urf_HeightControlDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
  firePrevention: 'https://assets.cms.plateau.reearth.io/assets/d9/5ce2d6-0aa8-4a17-a86a-028c2dc2b817/13_tokyo_pref_2023_citygml_1_op_urf_FirePreventionDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
  // UseDistrict は既存の Geolonia で十分だが、クロスチェック用に参照可能
  useDistrict: 'https://assets.cms.plateau.reearth.io/assets/5b/8d0e14-be51-4739-bf91-13cc176472c8/13_tokyo_pref_2023_citygml_1_op_urf_UseDistrict_mvt_lod1/{z}/{x}/{y}.mvt',
};

interface PlateauUrfResult {
  heightDistrict: {
    type: string;
    maxHeight?: number;
    slopeRatio?: number;
    attributes?: Record<string, unknown>;
  } | null;
  fireDistrict: {
    type: string;
    attributes?: Record<string, unknown>;
  } | null;
  districtPlan: {
    name: string;
    restrictions?: string;
    maxHeight?: number;
    attributes?: Record<string, unknown>;
  } | null;
  useDistrict: {
    floorAreaRatio?: number;
    coverageRatio?: number;
    district?: string;
    attributes?: Record<string, unknown>;
  } | null;
}

/**
 * MVTフィーチャーの attributes JSON文字列をパースする。
 * PLATEAU urf の属性は properties.attributes に JSON文字列として格納されている。
 */
function parseAttributes(props: Record<string, unknown>): Record<string, unknown> {
  const attrStr = props['attributes'];
  if (typeof attrStr === 'string') {
    try { return JSON.parse(attrStr); } catch { /* ignore */ }
  }
  return props; // attributes フィールドがなければ props そのまま
}

async function queryTileAtPoint(
  urlTemplate: string,
  lat: number,
  lng: number,
  z: number,
  layerName?: string,
): Promise<{ properties: Record<string, unknown>; attributes: Record<string, unknown> } | null> {
  const { tileX, tileY } = latLngToTile(lat, lng, z);
  const tile = await fetchMvtTile(urlTemplate, z, tileX, tileY);
  if (!tile) return null;

  const layerNames = Object.keys(tile.layers);
  const targetLayer = layerName
    ? tile.layers[layerName]
    : tile.layers[layerNames[0]];

  if (!targetLayer || targetLayer.length === 0) return null;

  const extent = targetLayer.feature(0).extent;
  const { pixelX, pixelY } = latLngToPixel(lat, lng, z, tileX, tileY, extent);

  for (let i = 0; i < targetLayer.length; i++) {
    const feature = targetLayer.feature(i);
    if (pointInFeatureGeometry(pixelX, pixelY, feature)) {
      const props = feature.properties as Record<string, unknown>;
      return { properties: props, attributes: parseAttributes(props) };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lng } = await req.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'lat, lng が必要です' }, { status: 400 });
    }

    const z = 14;

    // 並列で3つのタイルを取得
    const [heightResult, fireResult, useResult] = await Promise.allSettled([
      queryTileAtPoint(TILE_URLS.heightControl, lat, lng, z),
      queryTileAtPoint(TILE_URLS.firePrevention, lat, lng, z),
      queryTileAtPoint(TILE_URLS.useDistrict, lat, lng, z),
    ]);

    const result: PlateauUrfResult = {
      heightDistrict: null,
      fireDistrict: null,
      districtPlan: null, // DistrictPlan は ward 別取得が必要（後続対応）
      useDistrict: null,
    };

    // 高度地区
    if (heightResult.status === 'fulfilled' && heightResult.value) {
      const { attributes } = heightResult.value;
      result.heightDistrict = {
        type: String(attributes['function'] ?? attributes['name'] ?? '不明'),
        maxHeight: typeof attributes['maximumBuildingHeight'] === 'number'
          ? attributes['maximumBuildingHeight'] : undefined,
        attributes,
      };
    }

    // 防火地域
    if (fireResult.status === 'fulfilled' && fireResult.value) {
      const { attributes } = fireResult.value;
      result.fireDistrict = {
        type: String(attributes['function'] ?? attributes['name'] ?? '指定なし'),
        attributes,
      };
    }

    // 用途地域（クロスチェック）
    if (useResult.status === 'fulfilled' && useResult.value) {
      const { attributes } = useResult.value;
      result.useDistrict = {
        floorAreaRatio: typeof attributes['floorAreaRatio'] === 'number'
          ? attributes['floorAreaRatio'] / 100 : undefined,
        coverageRatio: typeof attributes['buildingCoverageRatio'] === 'number'
          ? attributes['buildingCoverageRatio'] / 100 : undefined,
        district: String(attributes['function'] ?? attributes['districtsAndZonesType'] ?? ''),
        attributes,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[plateau-urf-lookup] Error:', error);
    return NextResponse.json({ error: 'PLATEAU都市計画情報の取得に失敗しました' }, { status: 500 });
  }
}
```

### Step 2: ビルド確認

```bash
pnpm build
```

### Step 3: コミット

```bash
git add src/app/api/plateau-urf-lookup/route.ts
git commit -m "feat: add PLATEAU urf lookup API for height/fire/use districts"
```

---

## Task 3: AddressSearch に PLATEAU urf を統合

**Files:**
- Modify: `src/components/site/AddressSearch.tsx`
- Modify: `src/components/site/site-helpers.ts`

### Step 1: AddressSearch で PLATEAU urf API を並行呼び出し

既存の `handleSearch` 内の `Promise.allSettled` に `/api/plateau-urf-lookup` を追加:

```typescript
const [zoningRes, shapeRes, plateauRes] = await Promise.allSettled([
  fetch('/api/zoning-lookup', { ... }),
  fetch('/api/site-shape-lookup', { ... }),
  fetch('/api/plateau-urf-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lng }),
  }),
]);
```

PLATEAU から高度地区が取れた場合、`buildZoningData` のオプションに渡す:

```typescript
let plateauHeightDistrict = undefined;
let plateauDistrictPlan = null;

if (plateauRes.status === 'fulfilled' && plateauRes.value.ok) {
  const plateauData = await plateauRes.value.json();

  if (plateauData.heightDistrict) {
    // 高度地区の型名をマッチング
    const hdType = matchHeightDistrictType(plateauData.heightDistrict.type);
    if (hdType) {
      plateauHeightDistrict = {
        type: hdType,
        absoluteMax: plateauData.heightDistrict.maxHeight,
      };
    }
  }

  if (plateauData.districtPlan) {
    plateauDistrictPlan = plateauData.districtPlan;
  }
}
```

### Step 2: site-helpers に matchHeightDistrictType 関数追加

```typescript
export function matchHeightDistrictType(
  raw: string
): '第一種' | '第二種' | '第三種' | '指定なし' | null {
  if (!raw) return null;
  if (raw.includes('第一種') || raw.includes('1種') || raw.includes('第1種')) return '第一種';
  if (raw.includes('第二種') || raw.includes('2種') || raw.includes('第2種')) return '第二種';
  if (raw.includes('第三種') || raw.includes('3種') || raw.includes('第3種')) return '第三種';
  return null;
}
```

### Step 3: ビルド + テスト

```bash
pnpm test --verbose && pnpm build
```

### Step 4: コミット

```bash
git add src/components/site/AddressSearch.tsx src/components/site/site-helpers.ts
git commit -m "feat: integrate PLATEAU urf into address search (height district auto-detect)"
```

---

## Task 4: ZoningSection に地区計画警告を表示

**Files:**
- Modify: `src/components/sidebar/ZoningSection.tsx`

### Step 1: 地区計画警告バナー追加

ZoningData に districtPlan がある場合、警告バナーを表示:

```tsx
{zoning.districtPlan && (
  <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 p-3 space-y-1">
    <div className="flex items-center gap-1.5">
      <WarningCircle className="h-4 w-4 text-amber-400" weight="fill" />
      <span className="text-xs font-medium text-amber-300">地区計画あり</span>
    </div>
    <p className="text-[11px] text-amber-200">{zoning.districtPlan.name}</p>
    {zoning.districtPlan.restrictions && (
      <p className="text-[10px] text-amber-400/70">{zoning.districtPlan.restrictions}</p>
    )}
    {zoning.districtPlan.maxHeight && (
      <p className="text-[10px] text-amber-400/70">
        最高高さ制限: {zoning.districtPlan.maxHeight}m
      </p>
    )}
    <p className="text-[10px] text-amber-400/50 mt-1">
      ※ 地区計画の詳細は管轄自治体にご確認ください
    </p>
  </div>
)}
```

### Step 2: 高度地区が PLATEAU から自動設定された場合の表示

既存の高度地区セレクトに「自動検出」バッジを追加。

### Step 3: ビルド確認

```bash
pnpm build
```

### Step 4: コミット

```bash
git add src/components/sidebar/ZoningSection.tsx
git commit -m "feat: show district plan warning and auto-detected height district in ZoningSection"
```

---

## Task 5: 計算エンジンに districtPlan の制限を適用

**Files:**
- Modify: `src/engine/envelope.ts` (or relevant calc entry point)

### Step 1: districtPlan.maxHeight がある場合、absoluteHeightLimit と比較して厳しい方を適用

```typescript
// envelope.ts の generateEnvelope 内
let effectiveAbsoluteHeight = zoning.absoluteHeightLimit ?? Infinity;
if (zoning.districtPlan?.maxHeight) {
  effectiveAbsoluteHeight = Math.min(effectiveAbsoluteHeight, zoning.districtPlan.maxHeight);
}
```

### Step 2: テスト追加

```typescript
// src/engine/__tests__/envelope.test.ts に追加
test('地区計画の最高高さ制限がenvelopeに反映される', () => {
  const input = createTestInput();
  input.zoning.districtPlan = { name: 'テスト地区計画', maxHeight: 15 };
  const result = generateEnvelope(input);
  expect(result.maxHeight).toBeLessThanOrEqual(15);
});
```

### Step 3: テスト実行

```bash
pnpm test -- --testPathPattern="envelope" --verbose
```
Expected: 全PASS

### Step 4: コミット

```bash
git add src/engine/envelope.ts src/engine/__tests__/envelope.test.ts
git commit -m "feat: apply district plan maxHeight to envelope calculation"
```

---

## 完了条件

- [ ] `pnpm build` 成功
- [ ] `pnpm test` 全PASS
- [ ] 東京23区の住所検索時に高度地区が自動設定される
- [ ] 地区計画がある場所で警告バナーが表示される
- [ ] 地区計画の最高高さ制限が計算エンジンに反映される
- [ ] PLATEAU非対応エリアでは既存のGeoloniaデータのみで動作する（フォールバック）
- [ ] 既存の手動設定（用途地域・高度地区の手動選択）が引き続き動作する
