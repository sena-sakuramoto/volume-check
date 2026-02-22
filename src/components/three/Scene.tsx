'use client';

import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from '@react-three/drei';
import { Suspense } from 'react';
import { SiteGround } from './SiteGround';
import { VolumeEnvelope } from './VolumeEnvelope';
import { SetbackLines } from './SetbackLines';
import type { VolumeResult, SiteBoundary, Road, ZoningData } from '@/engine/types';

interface SceneProps {
  site: SiteBoundary | null;
  roads: Road[];
  zoning: ZoningData | null;
  volumeResult: VolumeResult | null;
  layers: {
    road: boolean;
    adjacent: boolean;
    north: boolean;
    absoluteHeight: boolean;
    shadow: boolean;
  };
}

/** Compute a reasonable camera position based on site bounds */
function computeCameraPosition(site: SiteBoundary | null): [number, number, number] {
  if (!site || site.vertices.length === 0) return [15, 15, 15];

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
  const dist = span * 1.8;

  // Camera at southeast-ish angle, elevated
  return [cx + dist * 0.7, dist * 0.8, cy + dist * 0.7];
}

function computeTarget(site: SiteBoundary | null): [number, number, number] {
  if (!site || site.vertices.length === 0) return [0, 3, 0];

  let cx = 0, cy = 0;
  for (const v of site.vertices) {
    cx += v.x;
    cy += v.y;
  }
  cx /= site.vertices.length;
  cy /= site.vertices.length;

  return [cx, 3, cy];
}

export function Scene({ site, roads, zoning, volumeResult, layers }: SceneProps) {
  const cameraPos = useMemo(() => computeCameraPosition(site), [site]);
  const target = useMemo(() => computeTarget(site), [site]);

  return (
    <Canvas
      camera={{ position: cameraPos, fov: 45, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%' }}
      shadows
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[15, 30, 15]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-10, 15, -5]} intensity={0.3} />
        <hemisphereLight
          color="#b0d4ff"
          groundColor="#383838"
          intensity={0.5}
        />

        {/* Ground grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#4a4a4a"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#666666"
          fadeDistance={40}
          infiniteGrid
        />

        {/* Site + roads */}
        {site && <SiteGround site={site} roads={roads} />}

        {/* Volume envelope mesh */}
        {volumeResult && <VolumeEnvelope result={volumeResult} layers={layers} />}

        {/* Setback slope lines (斜線) */}
        {site && zoning && (
          <SetbackLines site={site} roads={roads} zoning={zoning} layers={layers} />
        )}

        {/* Controls */}
        <OrbitControls makeDefault target={target} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
        <axesHelper args={[3]} />
      </Suspense>
    </Canvas>
  );
}
