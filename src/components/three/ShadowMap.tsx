'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { ShadowProjectionResult, ShadowGridData, Point2D } from '@/engine/types';

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ShadowMapProps {
  shadowProjection: ShadowProjectionResult;
  /** Shadow mask for current time (1=shadow, 0=not) - same grid as shadowGrid */
  shadowMask: Uint8Array | null;
  /** Visibility toggles */
  showHeatmap: boolean;
  showMeasurementLines: boolean;
  showTimeShadow: boolean;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

interface ColorStop {
  h: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEATMAP_STOPS: ColorStop[] = [
  { h: 0, r: 254, g: 249, b: 195, a: 77 },
  { h: 1, r: 253, g: 224, b: 71, a: 102 },
  { h: 2, r: 251, g: 146, b: 60, a: 128 },
  { h: 3, r: 249, g: 115, b: 22, a: 153 },
  { h: 4, r: 234, g: 88, b: 12, a: 179 },
  { h: 5, r: 220, g: 38, b: 38, a: 204 },
];

function getHeatmapColor(hours: number): { r: number; g: number; b: number; a: number } {
  if (hours >= 5) return HEATMAP_STOPS[5];
  const idx = Math.floor(hours);
  const t = hours - idx;
  const a = HEATMAP_STOPS[idx];
  const b = HEATMAP_STOPS[Math.min(idx + 1, HEATMAP_STOPS.length - 1)];
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: Math.round(a.a + (b.a - a.a) * t),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shadow hours heatmap (等時間日影図) rendered as a DataTexture on a plane */
function ShadowHeatmap({ grid }: { grid: ShadowGridData }) {
  const { texture, centerX, centerZ, width, height } = useMemo(() => {
    const { cols, rows, originX, originY, resolution, hours } = grid;
    const data = new Uint8Array(cols * rows * 4);

    for (let i = 0; i < cols * rows; i++) {
      const h = hours[i];
      if (h < 0.1) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const color = getHeatmapColor(h);
      data[i * 4] = color.r;
      data[i * 4 + 1] = color.g;
      data[i * 4 + 2] = color.b;
      data[i * 4 + 3] = color.a;
    }

    const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    const w = cols * resolution;
    const h2 = rows * resolution;
    const cx = originX + w / 2;
    const cz = originY + h2 / 2;

    return { texture: tex, centerX: cx, centerZ: cz, width: w, height: h2 };
  }, [grid]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[centerX, 0.03, centerZ]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.01}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Time-specific shadow mask rendered as dark overlay */
function TimeShadow({ grid, mask }: { grid: ShadowGridData; mask: Uint8Array }) {
  const { texture, centerX, centerZ, width, height } = useMemo(() => {
    const { cols, rows, originX, originY, resolution } = grid;
    const data = new Uint8Array(cols * rows * 4);

    for (let i = 0; i < cols * rows; i++) {
      if (mask[i] === 1) {
        data[i * 4] = 30;
        data[i * 4 + 1] = 41;
        data[i * 4 + 2] = 59;
        data[i * 4 + 3] = 128;
      }
    }

    const tex = new THREE.DataTexture(data, cols, rows, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    const w = cols * resolution;
    const h = rows * resolution;
    const cx = originX + w / 2;
    const cz = originY + h / 2;

    return { texture: tex, centerX: cx, centerZ: cz, width: w, height: h };
  }, [grid, mask]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[centerX, 0.025, centerZ]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.01}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Dashed measurement line loop (5m or 10m offset) with label */
function MeasurementLine({
  points,
  color,
  label,
}: {
  points: Point2D[];
  color: string;
  label: string;
}) {
  const lineRef = useRef<THREE.LineLoop>(null);

  const geometry = useMemo(() => {
    const vec3Points = points.map((p) => new THREE.Vector3(p.x, 0.04, p.y));
    return new THREE.BufferGeometry().setFromPoints(vec3Points);
  }, [points]);

  // computeLineDistances on the LineLoop instance (required for dashed material)
  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances();
    }
  }, [geometry]);

  const labelPos: [number, number, number] = useMemo(
    () => (points.length > 0 ? [points[0].x, 0.06, points[0].y] : [0, 0, 0]),
    [points],
  );

  return (
    <group>
      <lineLoop ref={lineRef} geometry={geometry}>
        <lineDashedMaterial
          color={color}
          dashSize={0.5}
          gapSize={0.3}
          linewidth={1}
        />
      </lineLoop>
      <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: color,
            color: '#fff',
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/** Color legend overlay for shadow heatmap */
function ShadowLegend() {
  const legendItems = [
    { range: '0-1h', color: '#fef9c3', borderColor: '#d4c96a' },
    { range: '1-2h', color: '#fde047', borderColor: '#c9a820' },
    { range: '2-3h', color: '#fb923c', borderColor: '#c46a1a' },
    { range: '3-4h', color: '#f97316', borderColor: '#b85310' },
    { range: '4-5h', color: '#ea580c', borderColor: '#a83d08' },
    { range: '5h+', color: '#dc2626', borderColor: '#9e1b1b' },
  ];

  return (
    <Html
      position={[0, 0, 0]}
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        top: 'auto',
        transform: 'none',
      }}
      calculatePosition={() => [0, 0] as unknown as number[]}
      zIndexRange={[1000, 1000]}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          fontSize: '11px',
          color: '#1a1d23',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: '1px solid rgba(0,0,0,0.1)',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.3,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '2px' }}>日影時間</div>
        {legendItems.map((item) => (
          <div key={item.range} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '14px',
                background: item.color,
                border: `1px solid ${item.borderColor}`,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span>{item.range}</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShadowMap({
  shadowProjection,
  shadowMask,
  showHeatmap,
  showMeasurementLines,
  showTimeShadow,
}: ShadowMapProps) {
  return (
    <group>
      {showHeatmap && <ShadowHeatmap grid={shadowProjection.shadowGrid} />}

      {showTimeShadow && shadowMask && (
        <TimeShadow grid={shadowProjection.shadowGrid} mask={shadowMask} />
      )}

      {showMeasurementLines && shadowProjection.line5m.length > 0 && (
        <MeasurementLine points={shadowProjection.line5m} color="#f59e0b" label="5m" />
      )}

      {showMeasurementLines && shadowProjection.line10m.length > 0 && (
        <MeasurementLine points={shadowProjection.line10m} color="#ef4444" label="10m" />
      )}

      {showHeatmap && <ShadowLegend />}
    </group>
  );
}
