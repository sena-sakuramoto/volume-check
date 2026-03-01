# 3Dビューアー再構築 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** エンジンのワインディングバグを修正し、3Dビューアーコンポーネントを白紙から再構築する

**Architecture:** エンジン(`engine/envelope.ts`)のメッシュ生成を修正した上で、`components/three/`以下の全ファイルを再構築。Zustandストアでレイヤー・カメラ状態を管理し、R3F + drei + PBRマテリアルで建築模型品質のビューアーを構築する。

**Tech Stack:** React Three Fiber 9, drei 10, Three.js 0.183, Zustand 5, Next.js 16, TypeScript, Tailwind CSS 4

**Design doc:** `docs/plans/2026-02-27-3d-viewer-rebuild-design.md`

---

## Task 1: Zustandインストール + Viewerストア作成

**Files:**
- Create: `src/stores/useViewerStore.ts`

**Step 1: Zustandをインストール**

Run: `cd /d/senaa_dev/volume-check && pnpm add zustand`
Expected: Success, zustand added to package.json

**Step 2: Viewerストアを作成**

```typescript
// src/stores/useViewerStore.ts
import { create } from 'zustand';

export type LayerPreset = 'basic' | 'shadow' | 'pattern' | 'custom';

export interface LayerState {
  road: boolean;
  adjacent: boolean;
  north: boolean;
  absoluteHeight: boolean;
  shadow: boolean;
  reverseShadowContours: boolean;
  reverseShadowHeightmap: boolean;
  shadowMeasurementLines: boolean;
  shadowHeatmap: boolean;
  shadowTimeShadow: boolean;
  floorPlates: boolean;
  buildingPatternLowRise: boolean;
  buildingPatternMidHigh: boolean;
  buildingPatternOptimal: boolean;
}

const PRESETS: Record<Exclude<LayerPreset, 'custom'>, LayerState> = {
  basic: {
    road: true, adjacent: true, north: true, absoluteHeight: true,
    shadow: false, reverseShadowContours: false, reverseShadowHeightmap: false,
    shadowMeasurementLines: false, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: false, buildingPatternMidHigh: false,
    buildingPatternOptimal: true,
  },
  shadow: {
    road: false, adjacent: false, north: false, absoluteHeight: false,
    shadow: true, reverseShadowContours: true, reverseShadowHeightmap: true,
    shadowMeasurementLines: true, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: false, buildingPatternMidHigh: false,
    buildingPatternOptimal: false,
  },
  pattern: {
    road: false, adjacent: false, north: false, absoluteHeight: false,
    shadow: false, reverseShadowContours: false, reverseShadowHeightmap: false,
    shadowMeasurementLines: true, shadowHeatmap: false, shadowTimeShadow: false,
    floorPlates: true, buildingPatternLowRise: true, buildingPatternMidHigh: true,
    buildingPatternOptimal: true,
  },
};

interface ViewerStore {
  preset: LayerPreset;
  layers: LayerState;
  shadowTimeValue: number;

  selectPreset: (p: LayerPreset) => void;
  toggleLayer: (key: keyof LayerState) => void;
  setShadowTime: (value: number) => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  preset: 'basic',
  layers: { ...PRESETS.basic },
  shadowTimeValue: 120,

  selectPreset: (p) =>
    set((state) => {
      if (p === 'custom') return { preset: 'custom' };
      return { preset: p, layers: { ...PRESETS[p] } };
    }),

  toggleLayer: (key) =>
    set((state) => ({
      preset: 'custom',
      layers: { ...state.layers, [key]: !state.layers[key] },
    })),

  setShadowTime: (value) => set({ shadowTimeValue: value }),
}));
```

**Step 3: ビルド確認**

Run: `cd /d/senaa_dev/volume-check && pnpm build 2>&1 | tail -5`
Expected: Build succeeds (store is created but not yet imported)

**Step 4: Commit**

```bash
git add src/stores/useViewerStore.ts package.json pnpm-lock.yaml
git commit -m "feat: add Zustand viewer store for layer/camera state management"
```

---

## Task 2: エンジンのワインディングバグ修正

**Files:**
- Modify: `src/engine/envelope.ts:497-500` (top surface triangles)

**Step 1: 上面の三角形ワインディングを修正**

File: `src/engine/envelope.ts`

変更箇所 (line 497-500):
```typescript
// Before:
      // Triangle 1: (00, 10, 01)
      indexList.push(v00, v10, v01);
      // Triangle 2: (10, 11, 01)
      indexList.push(v10, v11, v01);

// After:
      // Triangle 1: CCW from above → normal points up (+Y)
      indexList.push(v00, v01, v10);
      // Triangle 2: CCW from above → normal points up (+Y)
      indexList.push(v10, v01, v11);
```

**Step 2: ブラウザで確認**

Open: `http://localhost:3000/debug`
Expected: テーブルにデータが表示される（エンジン自体は以前から動いている）

Open: `http://localhost:3000/project` → 「デモを読み込み」ボタン
Expected: エンベロープが3D表示される（もし見えない場合、DoubleSideフォールバックで次Taskにて対応）

**Step 3: Commit**

```bash
git add src/engine/envelope.ts
git commit -m "fix: correct triangle winding order in heightFieldToMesh (normals pointed down)"
```

---

## Task 3: Viewer.tsx — Canvasと環境の再構築

**Files:**
- Create: `src/components/three/Viewer.tsx`

旧`Scene.tsx`を置き換える新しいメインコンポーネント。

**Step 1: Viewer.tsx を作成**

```typescript
// src/components/three/Viewer.tsx
'use client';

import { useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import type { VolumeResult, SiteBoundary, Road, ZoningData, PatternResult } from '@/engine/types';
import { useViewerStore } from '@/stores/useViewerStore';
import { EnvelopeMesh } from './EnvelopeMesh';
import { SetbackLayer } from './SetbackLayer';
import { SitePlane } from './SitePlane';
import { FloorSlices } from './FloorSlices';
import { ShadowMap } from './ShadowMap';
import { ReverseShadow } from './ReverseShadow';
import { PatternWireframe } from './PatternWireframe';

export interface ViewerProps {
  site: SiteBoundary | null;
  roads: Road[];
  zoning: ZoningData | null;
  volumeResult: VolumeResult | null;
  floorHeights: number[];
  shadowTime: { hour: number; minute: number } | null;
  shadowMask: Uint8Array | null;
}

function computeCamera(site: SiteBoundary | null): {
  position: [number, number, number];
  target: [number, number, number];
} {
  if (!site || site.vertices.length === 0) {
    return { position: [15, 15, 15], target: [0, 3, 0] };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of site.vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY, 10);
  const dist = span * 2.0;

  return {
    position: [cx + dist * 0.6, dist * 0.7, cy + dist * 0.6],
    target: [cx, span * 0.15, cy],
  };
}

const SETBACK_COLORS: Record<string, string> = {
  road: '#d97706',
  adjacent: '#059669',
  north: '#7c3aed',
  absoluteHeight: '#dc2626',
  shadow: '#0891b2',
};

export function Viewer({ site, roads, zoning, volumeResult, floorHeights, shadowTime, shadowMask }: ViewerProps) {
  const { position: cameraPos, target } = useMemo(() => computeCamera(site), [site]);
  const layers = useViewerStore((s) => s.layers);

  return (
    <Canvas
      camera={{ position: cameraPos, fov: 45, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%', background: '#0f1218' }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[15, 25, 10]} intensity={1.2} />
        <directionalLight position={[-8, 15, -5]} intensity={0.3} />
        <Environment preset="city" background={false} environmentIntensity={0.5} />

        {/* Ground grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#22262e"
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor="#333a47"
          fadeDistance={40}
          infiniteGrid
        />

        {/* Site + roads */}
        {site && (
          <SitePlane
            site={site}
            roads={roads}
            buildablePolygon={volumeResult?.buildablePolygon}
          />
        )}

        {/* Main envelope */}
        {volumeResult && volumeResult.envelopeVertices.length > 0 && (
          <EnvelopeMesh
            vertices={volumeResult.envelopeVertices}
            indices={volumeResult.envelopeIndices}
          />
        )}

        {/* Setback layers */}
        {volumeResult && layers.road && volumeResult.setbackEnvelopes.road && (
          <SetbackLayer
            vertices={volumeResult.setbackEnvelopes.road.vertices}
            indices={volumeResult.setbackEnvelopes.road.indices}
            color={SETBACK_COLORS.road}
          />
        )}
        {volumeResult && layers.adjacent && volumeResult.setbackEnvelopes.adjacent && (
          <SetbackLayer
            vertices={volumeResult.setbackEnvelopes.adjacent.vertices}
            indices={volumeResult.setbackEnvelopes.adjacent.indices}
            color={SETBACK_COLORS.adjacent}
          />
        )}
        {volumeResult && layers.north && volumeResult.setbackEnvelopes.north && (
          <SetbackLayer
            vertices={volumeResult.setbackEnvelopes.north.vertices}
            indices={volumeResult.setbackEnvelopes.north.indices}
            color={SETBACK_COLORS.north}
          />
        )}
        {volumeResult && layers.absoluteHeight && volumeResult.setbackEnvelopes.absoluteHeight && (
          <SetbackLayer
            vertices={volumeResult.setbackEnvelopes.absoluteHeight.vertices}
            indices={volumeResult.setbackEnvelopes.absoluteHeight.indices}
            color={SETBACK_COLORS.absoluteHeight}
          />
        )}
        {volumeResult && layers.shadow && volumeResult.setbackEnvelopes.shadow && (
          <SetbackLayer
            vertices={volumeResult.setbackEnvelopes.shadow.vertices}
            indices={volumeResult.setbackEnvelopes.shadow.indices}
            color={SETBACK_COLORS.shadow}
          />
        )}

        {/* Floor plates */}
        {site && zoning && volumeResult && layers.floorPlates && (
          <FloorSlices
            site={site}
            zoning={zoning}
            floorHeights={floorHeights}
            maxHeight={volumeResult.maxHeight}
          />
        )}

        {/* Reverse shadow overlay */}
        {volumeResult?.reverseShadow && (
          <ReverseShadow
            reverseShadow={volumeResult.reverseShadow}
            showContours={layers.reverseShadowContours}
            showHeightmap={layers.reverseShadowHeightmap}
            showMeasurementLines={layers.shadowMeasurementLines}
          />
        )}

        {/* Shadow projection overlay */}
        {site && volumeResult?.shadowProjection && (
          <ShadowMap
            shadowProjection={volumeResult.shadowProjection}
            siteVertices={site.vertices}
            shadowTime={shadowTime ?? null}
            shadowMask={shadowMask ?? null}
            showHeatmap={layers.shadowHeatmap}
            showMeasurementLines={!layers.reverseShadowContours && layers.shadowMeasurementLines}
            showTimeShadow={layers.shadowTimeShadow}
          />
        )}

        {/* Setback boundary markers + labels */}
        {/* Note: SetbackLines imported from old code - keep as-is for now */}

        {/* Building pattern wireframes */}
        {volumeResult?.buildingPatterns?.lowRise && layers.buildingPatternLowRise && (
          <PatternWireframe pattern={volumeResult.buildingPatterns.lowRise} color="#f97316" />
        )}
        {volumeResult?.buildingPatterns?.midHighRise && layers.buildingPatternMidHigh && (
          <PatternWireframe pattern={volumeResult.buildingPatterns.midHighRise} color="#a855f7" />
        )}
        {volumeResult?.buildingPatterns?.optimal && layers.buildingPatternOptimal && (
          <PatternWireframe pattern={volumeResult.buildingPatterns.optimal} color="#22d3ee" />
        )}

        {/* Controls */}
        <OrbitControls makeDefault target={target} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      </Suspense>
    </Canvas>
  );
}
```

**Step 2: ビルド確認（まだ子コンポーネント未作成なのでimportエラーが出る — 次Taskで解消）**

ビルドは子コンポーネント作成後にまとめて確認する。

---

## Task 4: EnvelopeMesh + SetbackLayer コンポーネント

**Files:**
- Create: `src/components/three/EnvelopeMesh.tsx`
- Create: `src/components/three/SetbackLayer.tsx`

**Step 1: EnvelopeMesh.tsx**

```typescript
// src/components/three/EnvelopeMesh.tsx
'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface EnvelopeMeshProps {
  vertices: Float32Array;
  indices: Uint32Array;
}

function createGeometry(vertices: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function EnvelopeMesh({ vertices, indices }: EnvelopeMeshProps) {
  const geometry = useMemo(() => createGeometry(vertices, indices), [vertices, indices]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#e8eaed"
        roughness={0.6}
        metalness={0.05}
        transparent
        opacity={0.92}
        side={THREE.DoubleSide}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}
```

**Step 2: SetbackLayer.tsx**

```typescript
// src/components/three/SetbackLayer.tsx
'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface SetbackLayerProps {
  vertices: Float32Array;
  indices: Uint32Array;
  color: string;
}

function createGeometry(vertices: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function SetbackLayer({ vertices, indices, color }: SetbackLayerProps) {
  const geometry = useMemo(() => createGeometry(vertices, indices), [vertices, indices]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
```

---

## Task 5: SitePlane コンポーネント

**Files:**
- Create: `src/components/three/SitePlane.tsx`

**Step 1: SitePlane.tsx — 旧SiteGround.tsxのロジックをPBRマテリアルで再実装**

旧`SiteGround.tsx`と同じロジック（Shape→XZ平面回転）をStandardMaterialで再実装。
コードは既存`SiteGround.tsx`をベースに、マテリアルを`meshBasicMaterial`→`meshStandardMaterial`に変更。

```typescript
// src/components/three/SitePlane.tsx
'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SiteBoundary, Road, Point2D } from '@/engine/types';

interface SitePlaneProps {
  site: SiteBoundary;
  roads: Road[];
  buildablePolygon?: Point2D[] | null;
}

export function SitePlane({ site, roads, buildablePolygon }: SitePlaneProps) {
  const siteShape = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(site.vertices[0].x, site.vertices[0].y);
    for (let i = 1; i < site.vertices.length; i++) {
      shape.lineTo(site.vertices[i].x, site.vertices[i].y);
    }
    shape.closePath();
    return shape;
  }, [site.vertices]);

  const outlineGeometry = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const points = site.vertices.map((v) => new THREE.Vector3(v.x, 0.02, v.y));
    points.push(new THREE.Vector3(site.vertices[0].x, 0.02, site.vertices[0].y));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [site.vertices]);

  const roadShapes = useMemo(() => {
    return roads.map((road) => {
      const dx = road.edgeEnd.x - road.edgeStart.x;
      const dy = road.edgeEnd.y - road.edgeStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return null;
      const bearingRad = (road.bearing * Math.PI) / 180;
      const nx = Math.sin(bearingRad);
      const ny = Math.cos(bearingRad);
      const shape = new THREE.Shape();
      shape.moveTo(road.edgeStart.x, road.edgeStart.y);
      shape.lineTo(road.edgeEnd.x, road.edgeEnd.y);
      shape.lineTo(road.edgeEnd.x + nx * road.width, road.edgeEnd.y + ny * road.width);
      shape.lineTo(road.edgeStart.x + nx * road.width, road.edgeStart.y + ny * road.width);
      shape.closePath();
      return shape;
    });
  }, [roads]);

  const buildableOutline = useMemo(() => {
    if (!buildablePolygon || buildablePolygon.length < 3) return null;
    const points = buildablePolygon.map((v) => new THREE.Vector3(v.x, 0.03, v.y));
    points.push(new THREE.Vector3(buildablePolygon[0].x, 0.03, buildablePolygon[0].y));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [buildablePolygon]);

  return (
    <group>
      {siteShape && (
        <mesh rotation-x={Math.PI / 2} position-y={0.01}>
          <shapeGeometry args={[siteShape]} />
          <meshStandardMaterial
            color="#5de4c7"
            roughness={0.9}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {outlineGeometry && (
        <line>
          <bufferGeometry attach="geometry" {...outlineGeometry} />
          <lineBasicMaterial color="#3dd4aa" linewidth={2} />
        </line>
      )}
      {buildableOutline && (
        <line>
          <bufferGeometry attach="geometry" {...buildableOutline} />
          <lineBasicMaterial color="#f4b860" linewidth={1} transparent opacity={0.85} />
        </line>
      )}
      {roadShapes.map((shape, i) =>
        shape ? (
          <mesh key={`road-${i}`} rotation-x={Math.PI / 2} position-y={0.005}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.95}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : null
      )}
    </group>
  );
}
```

---

## Task 6: FloorSlices + PatternWireframe コンポーネント

**Files:**
- Create: `src/components/three/FloorSlices.tsx`
- Create: `src/components/three/PatternWireframe.tsx`

**Step 1: FloorSlices.tsx — 旧FloorPlates.tsxのクリーン再実装**

旧`FloorPlates.tsx`と同じロジック。`visible` propを削除（Viewer側でレイヤーチェック済み）。

```typescript
// src/components/three/FloorSlices.tsx
'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SiteBoundary, ZoningData } from '@/engine/types';
import { applyWallSetback } from '@/engine/wall-setback';

interface FloorSlicesProps {
  site: SiteBoundary;
  zoning: ZoningData;
  floorHeights: number[];
  maxHeight: number;
}

export function FloorSlices({ site, zoning, floorHeights, maxHeight }: FloorSlicesProps) {
  const wallSetback = zoning.wallSetback ?? 0;

  const insetVertices = useMemo(() => {
    if (site.vertices.length < 3 || wallSetback <= 0) return site.vertices;
    return applyWallSetback(site.vertices, wallSetback);
  }, [site.vertices, wallSetback]);

  const floorElevations = useMemo(() => {
    const elevations: number[] = [];
    let h = 0;
    for (const fh of floorHeights) {
      h += fh;
      if (h > maxHeight + 0.01) break;
      elevations.push(h);
    }
    return elevations;
  }, [floorHeights, maxHeight]);

  const plateGeometry = useMemo(() => {
    if (insetVertices.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(insetVertices[0].x, insetVertices[0].y);
    for (let i = 1; i < insetVertices.length; i++) {
      shape.lineTo(insetVertices[i].x, insetVertices[i].y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [insetVertices]);

  if (floorElevations.length === 0 || !plateGeometry) return null;

  return (
    <group>
      {floorElevations.map((elev, i) => (
        <group key={i}>
          <mesh geometry={plateGeometry} position={[0, elev, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#5de4c7" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <Html position={[insetVertices[0].x, elev + 0.1, insetVertices[0].y]} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(93, 228, 199, 0.75)', color: '#fff',
              padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {i + 1}F ({elev.toFixed(1)}m)
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
```

**Step 2: PatternWireframe.tsx — 旧BuildingPatternBox抽出**

```typescript
// src/components/three/PatternWireframe.tsx
'use client';

import { useMemo } from 'react';
import type { PatternResult } from '@/engine/types';

interface PatternWireframeProps {
  pattern: PatternResult;
  color: string;
}

export function PatternWireframe({ pattern, color }: PatternWireframeProps) {
  const geometry = useMemo(() => {
    if (!pattern.footprint || pattern.footprint.length < 3 || pattern.maxHeight <= 0) return null;

    const fp = pattern.footprint;
    const h = pattern.maxHeight;
    const n = fp.length;
    const points: number[] = [];

    for (let i = 0; i < n; i++) {
      const a = fp[i];
      const b = fp[(i + 1) % n];
      points.push(a.x, 0, a.y, b.x, 0, b.y);
    }
    for (let i = 0; i < n; i++) {
      const a = fp[i];
      const b = fp[(i + 1) % n];
      points.push(a.x, h, a.y, b.x, h, b.y);
    }
    for (let i = 0; i < n; i++) {
      const v = fp[i];
      points.push(v.x, 0, v.y, v.x, h, v.y);
    }

    return new Float32Array(points);
  }, [pattern]);

  if (!geometry) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
    </lineSegments>
  );
}
```

---

## Task 7: ShadowMap + ReverseShadow コンポーネント

**Files:**
- Create: `src/components/three/ShadowMap.tsx`
- Create: `src/components/three/ReverseShadow.tsx`

**Step 1: ShadowMap.tsx — 旧ShadowOverlay.tsxをそのまま名前変更+再エクスポート**

旧`ShadowOverlay.tsx`は良く書けているのでロジックはそのまま持ってくる。
ファイル名とexport名だけ変更。

```typescript
// src/components/three/ShadowMap.tsx
// 旧ShadowOverlay.tsxの内容をコピー。export名を ShadowOverlay → ShadowMap に。
// それ以外の変更なし。
```

実装指示: `ShadowOverlay.tsx`の内容をコピーし、`export function ShadowOverlay` → `export function ShadowMap` にリネーム。

**Step 2: ReverseShadow.tsx — 旧ReverseShadowOverlay.tsxを名前変更+再エクスポート**

```typescript
// src/components/three/ReverseShadow.tsx
// 旧ReverseShadowOverlay.tsxの内容をコピー。export名を ReverseShadowOverlay → ReverseShadow に。
```

実装指示: `ReverseShadowOverlay.tsx`の内容をコピーし、`export function ReverseShadowOverlay` → `export function ReverseShadow` にリネーム。

---

## Task 8: page.tsx の接続変更 + LayerPresetBar更新

**Files:**
- Modify: `src/app/project/page.tsx`
- Modify: `src/components/layers/LayerPresetBar.tsx`

**Step 1: page.tsx — Viewer接続とストア統合**

主な変更:
1. `import { useLayerPresets }` → 削除
2. `import { useViewerStore }` を追加
3. `const { preset, layers, selectPreset, toggleLayer } = useLayerPresets()` → `const { preset, layers, selectPreset, toggleLayer, shadowTimeValue, setShadowTime } = useViewerStore()`
4. `const [shadowTimeValue, setShadowTimeValue] = useState(120)` → 削除
5. `Scene` import → `Viewer` import に変更
6. `<Scene ... />` → `<Viewer site={site} roads={roads} zoning={zoning} volumeResult={volumeResult} floorHeights={effectiveFloorHeights} shadowTime={...} shadowMask={shadowMask} />`
7. `<LayerPresetBar>` の props を削除（ストアから直接読み取る）

**Step 2: LayerPresetBar.tsx — ストア直接接続**

主な変更:
1. Props interfaceの`preset`, `layers`, `onSelectPreset`, `onToggleLayer`を削除
2. `import { useViewerStore }` を追加
3. コンポーネント内で `const { preset, layers, selectPreset, toggleLayer } = useViewerStore()` を使用
4. `LayerState` の import を `@/stores/useViewerStore` に変更

---

## Task 9: 旧ファイル削除 + ビルド確認

**Files:**
- Delete: `src/components/three/Scene.tsx`
- Delete: `src/components/three/VolumeEnvelope.tsx`
- Delete: `src/components/three/SiteGround.tsx`
- Delete: `src/components/three/FloorPlates.tsx`
- Delete: `src/components/three/ShadowOverlay.tsx`
- Delete: `src/components/three/ReverseShadowOverlay.tsx`
- Delete: `src/hooks/useLayerPresets.ts`
- Delete: `src/app/debug/page.tsx`

**Step 1: 旧ファイル削除**

Run:
```bash
rm src/components/three/Scene.tsx
rm src/components/three/VolumeEnvelope.tsx
rm src/components/three/SiteGround.tsx
rm src/components/three/FloorPlates.tsx
rm src/components/three/ShadowOverlay.tsx
rm src/components/three/ReverseShadowOverlay.tsx
rm src/hooks/useLayerPresets.ts
rm src/app/debug/page.tsx
```

Note: `SetbackLines.tsx` は Viewer.tsx から直接importせず、必要なら後で統合。一旦残す。

**Step 2: import参照の更新確認**

- `layer-presets.ts` が `useLayerPresets` からtype importしている → `useViewerStore`からの import に変更
- `useLayerPresets` を参照している他のファイルがないかgrep確認

**Step 3: ビルド確認**

Run: `cd /d/senaa_dev/volume-check && pnpm build 2>&1 | tail -10`
Expected: ビルド成功

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: rebuild 3D viewer with PBR materials and Zustand state management

- Fix triangle winding order in engine (normals now point up)
- Replace Scene.tsx with Viewer.tsx (PBR + environment map)
- Add Zustand store for layer/camera state
- Split into focused components (EnvelopeMesh, SetbackLayer, SitePlane, etc.)
- Remove old three/ components and useLayerPresets hook
- Remove debug page"
```

---

## Task 10: ブラウザ検証 + 微調整

**Step 1: デモデータでの検証**

1. `http://localhost:3000/project` を開く
2. 「デモを読み込み」ボタンを押す
3. 確認項目:
   - [ ] エンベロープ（灰白のボリューム）が3D表示される
   - [ ] 敷地（緑のポリゴン）が表示される
   - [ ] 道路（灰色の帯）が表示される
   - [ ] 建築可能範囲（金色のライン）が表示される
   - [ ] レイヤー切替ボタンが動作する
   - [ ] 斜線制限レイヤー（色分け半透明）が表示される
   - [ ] カメラ操作（回転、ズーム、パン）が動作する
   - [ ] 階床プレート（レイヤーON時）が表示される
   - [ ] コンソールにエラーがない

**Step 2: 問題があれば修正**

よくある問題と対処:
- エンベロープが見えない → マテリアルのsideをDoubleSideに（済み）
- 環境マップが重い → `environmentIntensity`を下げるか`preset`を`apartment`に
- モバイルでカクつく → `dpr={[1, 1.5]}`をCanvasに追加

**Step 3: 最終ビルド確認**

Run: `cd /d/senaa_dev/volume-check && pnpm build 2>&1 | tail -10`
Expected: ビルド成功

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: viewer adjustments after browser verification"
```

---

## 完了条件チェックリスト

- [ ] デモデータでエンベロープが正しく3D表示される
- [ ] 斜線制限レイヤーが色分けで表示される
- [ ] 敷地・道路が正しく表示される
- [ ] レイヤー切替が動作する
- [ ] カメラ操作（回転・ズーム・パン）が動作する
- [ ] `pnpm build` 成功
- [ ] デバッグページ(/debug)削除済み
