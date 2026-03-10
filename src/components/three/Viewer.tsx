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
import type { VolumeResult, SiteBoundary, Road, ZoningData } from '@/engine/types';
import { useViewerStore } from '@/stores/useViewerStore';
import { EnvelopeMesh } from './EnvelopeMesh';
import { SetbackLayer } from './SetbackLayer';
import { SetbackLines } from './SetbackLines';
import { SitePlane } from './SitePlane';
import { FloorSlices } from './FloorSlices';
import { ShadowMap } from './ShadowMap';
import { ReverseShadow } from './ReverseShadow';
import { PatternWireframe } from './PatternWireframe';
import { TrueNorthArrow } from './TrueNorthArrow';

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
  road: '#f59e0b',
  adjacent: '#10b981',
  north: '#8b5cf6',
  absoluteHeight: '#ef4444',
  shadow: '#22d3ee',
};

export function Viewer({ site, roads, zoning, volumeResult, floorHeights, shadowTime, shadowMask }: ViewerProps) {
  void shadowTime;
  const { position: cameraPos, target } = useMemo(() => computeCamera(site), [site]);
  const layers = useViewerStore((s) => s.layers);

  return (
    <Canvas
      camera={{ position: cameraPos, fov: 45, near: 0.1, far: 500 }}
      style={{ width: '100%', height: '100%', background: '#f2f6fc' }}
      dpr={[1.5, 2.5]}
      gl={{ antialias: true }}
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[15, 25, 10]} intensity={1.2} />
        <directionalLight position={[-8, 15, -5]} intensity={0.3} />
        <Environment preset="city" background={false} environmentIntensity={0.45} />

        {/* Ground grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#bcc7d8"
          sectionSize={5}
          sectionThickness={0.8}
          sectionColor="#8ca0ba"
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
            footprint={volumeResult.buildablePolygon ?? site.vertices}
            floorHeights={floorHeights}
            maxHeight={volumeResult.maxHeight}
            heightField={volumeResult.heightFieldData}
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
            shadowMask={shadowMask ?? null}
            showHeatmap={layers.shadowHeatmap}
            showMeasurementLines={!layers.reverseShadowContours && layers.shadowMeasurementLines}
            showTimeShadow={layers.shadowTimeShadow}
          />
        )}

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

        {/* Setback boundary markers + slope lines + labels */}
        {site && zoning && roads.length > 0 && (
          <SetbackLines
            site={site}
            roads={roads}
            zoning={zoning}
            layers={layers}
          />
        )}

        {/* True north compass arrow */}
        {site && roads.length > 0 && (
          <TrueNorthArrow site={site} roads={roads} />
        )}

        {/* Controls */}
        <OrbitControls makeDefault target={target} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport labelColor="#0f172a" axisHeadScale={1} />
        </GizmoHelper>
      </Suspense>
    </Canvas>
  );
}
