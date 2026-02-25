'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Point2D, ReverseShadowResult, ContourLine, HeightFieldData } from '@/engine/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReverseShadowOverlayProps {
  reverseShadow: ReverseShadowResult;
  /** Show contour lines (逆日影ライン) */
  showContours: boolean;
  /** Show shadow height heatmap */
  showHeightmap: boolean;
  /** Show 5m/10m measurement lines */
  showMeasurementLines: boolean;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/** Height-based color: low=red (constrained), high=green (less constrained) */
function getHeightColor(h: number, minH: number, maxH: number): { r: number; g: number; b: number; a: number } {
  if (maxH <= minH) return { r: 100, g: 200, b: 100, a: 140 };
  const t = Math.max(0, Math.min(1, (h - minH) / (maxH - minH)));
  // Red (constrained) → Yellow → Green (less constrained)
  const r = Math.round(220 - t * 180);
  const g = Math.round(60 + t * 160);
  const b = Math.round(40);
  const a = Math.round(120 + (1 - t) * 60);
  return { r, g, b, a };
}

// Contour line colors: alternating for readability
const CONTOUR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f59e0b', '#6366f1',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Reverse shadow height heatmap on building footprint (逆日影高さ制限面) */
function ShadowHeightmap({ field }: { field: HeightFieldData }) {
  const { texture, centerX, centerZ, width, height } = useMemo(() => {
    const { cols, rows, originX, originY, resolution, heights, insideMask } = field;

    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < heights.length; i++) {
      if (insideMask[i] === 0) continue;
      if (heights[i] > 0 && heights[i] < minH) minH = heights[i];
      if (heights[i] > maxH) maxH = heights[i];
    }

    const data = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < cols * rows; i++) {
      if (insideMask[i] === 0 || heights[i] <= 0) {
        data[i * 4 + 3] = 0;
        continue;
      }
      const color = getHeightColor(heights[i], minH, maxH);
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
    return {
      texture: tex,
      centerX: originX + w / 2,
      centerZ: originY + h2 / 2,
      width: w,
      height: h2,
    };
  }, [field]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[centerX, 0.035, centerZ]}>
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

/** Single contour line rendered as line segments with label */
function ContourLineDisplay({
  contour,
  colorIndex,
}: {
  contour: ContourLine;
  colorIndex: number;
}) {
  const color = CONTOUR_COLORS[colorIndex % CONTOUR_COLORS.length];

  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const seg of contour.segments) {
      // Engine (x, y) → Three.js (x, Y=0.05, z=y)
      positions.push(seg.start.x, 0.05, seg.start.y);
      positions.push(seg.end.x, 0.05, seg.end.y);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [contour.segments]);

  // Place label at the first segment midpoint
  const labelPos: [number, number, number] = useMemo(() => {
    if (contour.segments.length === 0) return [0, 0, 0];
    const seg = contour.segments[0];
    return [
      (seg.start.x + seg.end.x) / 2,
      0.08,
      (seg.start.y + seg.end.y) / 2,
    ];
  }, [contour.segments]);

  if (contour.segments.length === 0) return null;

  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} linewidth={2} />
      </lineSegments>
      <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.75)',
            color,
            padding: '1px 4px',
            borderRadius: '2px',
            fontSize: '9px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            border: `1px solid ${color}`,
          }}
        >
          {contour.height}m
        </div>
      </Html>
    </group>
  );
}

/** Dashed measurement line (5m/10m offset) */
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
        <lineDashedMaterial color={color} dashSize={0.5} gapSize={0.3} linewidth={1} />
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

/** Legend for reverse shadow contour lines */
function ReverseShadowLegend({ contourLines }: { contourLines: ContourLine[] }) {
  return (
    <Html
      position={[0, 0, 0]}
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        top: 'auto',
        left: 'auto',
        transform: 'none',
      }}
      calculatePosition={() => [0, 0] as unknown as number[]}
      zIndexRange={[1000, 1000]}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          fontSize: '11px',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.3,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '2px' }}>逆日影ライン</div>
        {contourLines.map((cl, i) => (
          <div key={cl.height} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '14px',
                height: '3px',
                background: CONTOUR_COLORS[i % CONTOUR_COLORS.length],
                flexShrink: 0,
              }}
            />
            <span>{cl.height}m</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ReverseShadowOverlay renders 逆日影 (reverse shadow) analysis:
 *
 * 1. **Contour lines (逆日影ライン)**: Height contours showing where
 *    shadow regulation constrains building height. These are the lines
 *    practitioners need to understand the maximum buildable envelope.
 *
 * 2. **Height heatmap**: Color-coded visualization of the shadow height
 *    constraint surface (red=low/constrained, green=high/less constrained).
 *
 * 3. **Measurement lines**: 5m/10m offset lines from site boundary.
 */
export function ReverseShadowOverlay({
  reverseShadow,
  showContours,
  showHeightmap,
  showMeasurementLines,
}: ReverseShadowOverlayProps) {
  return (
    <group>
      {showHeightmap && (
        <ShadowHeightmap field={reverseShadow.shadowHeightField} />
      )}

      {showContours && reverseShadow.contourLines.map((cl, i) => (
        <ContourLineDisplay key={cl.height} contour={cl} colorIndex={i} />
      ))}

      {showMeasurementLines && reverseShadow.line5m.length > 0 && (
        <MeasurementLine points={reverseShadow.line5m} color="#f59e0b" label="5m" />
      )}

      {showMeasurementLines && reverseShadow.line10m.length > 0 && (
        <MeasurementLine points={reverseShadow.line10m} color="#ef4444" label="10m" />
      )}

      {showContours && reverseShadow.contourLines.length > 0 && (
        <ReverseShadowLegend contourLines={reverseShadow.contourLines} />
      )}
    </group>
  );
}
