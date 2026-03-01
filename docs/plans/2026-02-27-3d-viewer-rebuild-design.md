# 3Dビューアー再構築 設計ドキュメント

**日付**: 2026-02-27
**対象**: volume-check 3Dビューアー (`src/components/three/`)
**方針**: アプローチB — 3Dビューアーのみクリーンルーム再構築

---

## 背景と問題

### 根本原因
`src/engine/envelope.ts` の `heightFieldToMesh()` 内で、三角形のワインディングオーダーが逆。
- 上面: v00→v10→v01 → 法線が -Y（下向き）
- FrontSide マテリアルのため、上から見ると裏面 → **エンベロープが見えない**

### エンジンの健全性
デモデータでの出力は正常:
- maxHeight: 9.24m, maxFloors: 3
- envelopeVertices: 2496, envelopeIndices: 4740
- buildablePolygon: [{x:1,y:1}, {x:9,y:1}, {x:9,y:14}, {x:1,y:14}]
- 全setbackEnvelope: データあり

→ エンジンの計算ロジックは正しい。メッシュ生成のワインディングとレンダリングの問題。

---

## スコープ

### 今回やること
1. エンジンのワインディングオーダー修正 (`envelope.ts`)
2. `src/components/three/` 全ファイルの白紙書き直し
3. Zustandストアで3D状態管理を集約
4. PBRマテリアル + 環境マップライティング
5. カメラプリセット改善

### 今回やらないこと
- 3Dエクスポート機能（glTF出力 → 次フェーズ）
- UIサイドバー・入力フォームの変更
- エンジンの計算ロジック変更（ワインディング以外）
- モバイルレイアウトの変更

---

## 1. エンジン修正 (`envelope.ts`)

### heightFieldToMesh() のワインディング修正

**上面（Top surface）**:
```
// Before (法線↓):
indexList.push(v00, v10, v01);  // Triangle 1
indexList.push(v10, v11, v01);  // Triangle 2

// After (法線↑):
indexList.push(v00, v01, v10);  // Triangle 1
indexList.push(v10, v01, v11);  // Triangle 2
```

**底面（Ground plane）**: 現在のワインディングは正しい（法線↓）。変更不要。

**側面（Side walls）**: computeVertexNormals() で自動計算されるが、
外向き法線が正しく出るか検証必要。問題があれば修正。

**安全策**: レンダリング側でも `DoubleSide` をフォールバックとして使う。

---

## 2. 3Dビューアー アーキテクチャ

### 状態管理: Zustand Store

```typescript
// src/stores/useViewerStore.ts
interface ViewerState {
  // レイヤー表示
  layers: {
    envelope: boolean;
    road: boolean;
    adjacent: boolean;
    north: boolean;
    absoluteHeight: boolean;
    shadow: boolean;
    floorPlates: boolean;
    shadowHeatmap: boolean;
    shadowTimeShadow: boolean;
    reverseShadowContours: boolean;
    reverseShadowHeightmap: boolean;
    buildingPatternLowRise: boolean;
    buildingPatternMidHigh: boolean;
    buildingPatternOptimal: boolean;
  };

  // カメラ
  cameraPreset: 'default' | 'top' | 'front' | 'side';

  // 日影
  shadowTimeValue: number;

  // アクション
  toggleLayer: (key: string) => void;
  setPreset: (preset: LayerPreset) => void;
  setCameraPreset: (preset: string) => void;
  setShadowTime: (value: number) => void;
}
```

→ `useLayerPresets` hook を Zustand store に統合。
→ page.tsx から layers/preset の状態を削除し、store から読み取り。

### コンポーネント構成

```
src/components/three/
├── Viewer.tsx           # Canvas + Environment + Camera + Controls
├── EnvelopeMesh.tsx     # メインエンベロープ（PBR）
├── SetbackLayer.tsx     # 斜線制限オーバーレイ（色分け半透明）
├── SitePlane.tsx        # 敷地ポリゴン + 道路 + 建築可能範囲
├── FloorSlices.tsx      # 階床プレート
├── ShadowMap.tsx        # 日影投影 + 時刻影
├── ReverseShadow.tsx    # 逆日影コンター
├── PatternWireframe.tsx # 建物パターンワイヤーフレーム
└── ViewerOverlay.tsx    # 3Dビュー上のUI（レイヤーバー等、HTMLオーバーレイ）
```

### データフロー

```
page.tsx
  ├── volumeResult (from useVolumeCalculation) → Viewer props
  ├── site, roads → SitePlane props
  └── floorHeights → FloorSlices props

useViewerStore (Zustand)
  ├── layers → 各コンポーネントが直接subscribe
  ├── cameraPreset → Viewer内のカメラ制御
  └── shadowTimeValue → ShadowMap
```

Props: volumeResult, site, roads, zoning, floorHeights（計算データ）
Store: layers, cameraPreset, shadowTime（UI状態）

---

## 3. マテリアル設計

### エンベロープ（メイン）
```typescript
<meshStandardMaterial
  color="#e8eaed"
  roughness={0.6}
  metalness={0.05}
  transparent
  opacity={0.92}
  side={THREE.DoubleSide}
  envMapIntensity={0.8}
/>
```
→ 建築模型的なマットな質感。環境マップの微妙な反射で立体感。

### 斜線制限レイヤー
```typescript
const SETBACK_COLORS = {
  road: '#d97706',      // amber-600
  adjacent: '#059669',  // emerald-600
  north: '#7c3aed',     // violet-600
  absoluteHeight: '#dc2626', // red-600
  shadow: '#0891b2',    // cyan-600
};

<meshStandardMaterial
  color={SETBACK_COLORS[type]}
  roughness={0.8}
  transparent
  opacity={0.35}
  side={THREE.DoubleSide}
  depthWrite={false}
/>
```

### 敷地
```typescript
// 敷地ポリゴン fill
<meshStandardMaterial color="#5de4c7" roughness={0.9} opacity={0.2} transparent />

// 道路面
<meshStandardMaterial color="#9ca3af" roughness={0.95} opacity={0.5} transparent />

// 建築可能範囲アウトライン
<lineBasicMaterial color="#f4b860" linewidth={2} />
```

---

## 4. ライティング

### 環境マップ
```typescript
import { Environment } from '@react-three/drei';
<Environment preset="city" background={false} environmentIntensity={0.5} />
```
→ 自然な間接光。重すぎない 'city' プリセット。

### 太陽光（メイン）
```typescript
<directionalLight
  position={[15, 25, 10]}
  intensity={1.2}
  castShadow
  shadow-mapSize={[1024, 1024]}
  shadow-camera-far={100}
/>
```

### アンビエント
```typescript
<ambientLight intensity={0.3} />
```

---

## 5. カメラ

### 自動フレーミング
```typescript
function computeCamera(site: SiteBoundary | null) {
  if (!site) return { position: [15, 15, 15], target: [0, 3, 0] };

  const bbox = getBoundingBox(site.vertices);
  const center = [(bbox.minX + bbox.maxX) / 2, 0, (bbox.minY + bbox.maxY) / 2];
  const span = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 10);
  const dist = span * 2.0;

  // 南東上空45°（建築パース標準）
  const position = [
    center[0] + dist * 0.6,
    dist * 0.7,
    center[2] + dist * 0.6,
  ];
  const target = [center[0], span * 0.15, center[2]];

  return { position, target };
}
```

### プリセット切替
- **デフォルト**: 南東俯瞰 45°
- **鳥瞰**: 真上から見下ろし
- **正面**: 南面立面
- **側面**: 西面立面

---

## 6. 既存コードとの接続

### page.tsx の変更
- `useLayerPresets` hook → Zustand store に置き換え
- `shadowTimeValue` state → Zustand store に移動
- Scene コンポーネントの props を簡素化:
  ```typescript
  <Viewer
    site={site}
    roads={roads}
    volumeResult={volumeResult}
    floorHeights={effectiveFloorHeights}
    zoning={zoning}
  />
  ```

### LayerPresetBar の変更
- props (preset, layers, onSelectPreset, onToggleLayer) → Zustand store から直接読み取り
- 場所: Viewer の外（HTML overlay）→ ViewerOverlay に移動

---

## 将来フェーズ（今回はスコープ外）

- [ ] glTF/GLBエクスポート
- [ ] 寸法線・注釈表示
- [ ] ホバーで制限値ツールチップ
- [ ] レイヤー選択でハイライト
- [ ] パフォーマンスLOD

---

## 完了条件

1. デモデータでエンベロープが正しく3D表示される
2. 斜線制限レイヤーが色分けで表示される
3. 敷地・道路が正しく表示される
4. レイヤー切替が動作する
5. カメラ操作（回転・ズーム・パン）が動作する
6. `pnpm build` 成功
7. デバッグページ(/debug)削除
