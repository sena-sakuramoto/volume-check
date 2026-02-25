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
  showContours: boolean;
  showHeightmap: boolean;
  showMeasurementLines: boolean;
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function getHeightColor(h: number, minH: number, maxH: number): { r: number; g: number; b: number; a: number } {
  if (maxH <= minH) return { r: 100, g: 200, b: 100, a: 200 };
  const t = Math.max(0, Math.min(1, (h - minH) / (maxH - minH)));
  // Blue-purple (constrained) → Cyan → Yellow → Green (less constrained)
  let r: number, g: number, b: number;
  if (t < 0.33) {
    const s = t / 0.33;
    r = Math.round(180 * (1 - s) + 20 * s);
    g = Math.round(40 * (1 - s) + 200 * s);
    b = Math.round(220 * (1 - s) + 220 * s);
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    r = Math.round(20 * (1 - s) + 240 * s);
    g = Math.round(200 * (1 - s) + 220 * s);
    b = Math.round(220 * (1 - s) + 40 * s);
  } else {
    const s = (t - 0.66) / 0.34;
    r = Math.round(240 * (1 - s) + 30 * s);
    g = Math.round(220 * (1 - s) + 200 * s);
    b = Math.round(40 * (1 - s) + 30 * s);
  }
  return { r, g, b, a: 200 };
}

// Highly visible contour colors
const CONTOUR_COLORS = [
  '#ff3333', '#ff8800', '#ffdd00', '#00cc44', '#0088ff', '#aa44ff',
  '#ff44aa', '#00ccaa', '#ff6600', '#4466ff',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Reverse shadow height heatmap - rendered as a large, visible overlay */
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
    // Use linear filter for smooth gradients instead of pixelated blocks
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;

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
    <mesh rotation-x={-Math.PI / 2} position={[centerX, 0.06, centerZ]}>
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

/**
 * Contour line rendered as a thick tube mesh (not lineSegments).
 * WebGL linewidth is always 1px, so we use TubeGeometry for visibility.
 */
function ContourLineDisplay({
  contour,
  colorIndex,
}: {
  contour: ContourLine;
  colorIndex: number;
}) {
  const color = CONTOUR_COLORS[colorIndex % CONTOUR_COLORS.length];
  const TUBE_RADIUS = 0.08;
  const Y_OFFSET = 0.12;

  // Chain segments into connected polylines, then render each as a tube
  const { meshes, labelPos } = useMemo(() => {
    if (contour.segments.length === 0) {
      return { meshes: [] as THREE.BufferGeometry[], labelPos: [0, 0, 0] as [number, number, number] };
    }

    // Build adjacency: chain segments that share endpoints
    const chains = chainSegments(contour.segments);

    const geos: THREE.BufferGeometry[] = [];

    for (const chain of chains) {
      if (chain.length < 2) continue;
      const points3d = chain.map((p) => new THREE.Vector3(p.x, Y_OFFSET, p.y));
      const curve = new THREE.CatmullRomCurve3(points3d, false, 'centripetal', 0.3);
      const tubeGeo = new THREE.TubeGeometry(curve, Math.max(4, chain.length * 2), TUBE_RADIUS, 4, false);
      geos.push(tubeGeo);
    }

    // Label at midpoint of the longest chain
    const longest = chains.reduce((a, b) => (a.length > b.length ? a : b), chains[0] ?? []);
    const mid = longest[Math.floor(longest.length / 2)] ?? contour.segments[0].start;
    const lp: [number, number, number] = [mid.x, Y_OFFSET + 0.3, mid.y];

    return { meshes: geos, labelPos: lp };
  }, [contour.segments]);

  if (meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      <Html position={labelPos} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(0,0,0,0.85)',
            color,
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            border: `2px solid ${color}`,
            textShadow: '0 0 4px rgba(0,0,0,0.5)',
          }}
        >
          {contour.height}m
        </div>
      </Html>
    </group>
  );
}

/** Chain disconnected segments into continuous polylines */
function chainSegments(segments: { start: Point2D; end: Point2D }[]): Point2D[][] {
  if (segments.length === 0) return [];

  const EPS = 0.01; // tolerance for matching endpoints
  const used = new Set<number>();
  const chains: Point2D[][] = [];

  const dist2 = (a: Point2D, b: Point2D) =>
    (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const close = (a: Point2D, b: Point2D) => dist2(a, b) < EPS * EPS;

  for (let seed = 0; seed < segments.length; seed++) {
    if (used.has(seed)) continue;
    used.add(seed);

    const chain: Point2D[] = [segments[seed].start, segments[seed].end];

    // Extend forward
    let extended = true;
    while (extended) {
      extended = false;
      const tail = chain[chain.length - 1];
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        if (close(tail, segments[i].start)) {
          chain.push(segments[i].end);
          used.add(i);
          extended = true;
          break;
        }
        if (close(tail, segments[i].end)) {
          chain.push(segments[i].start);
          used.add(i);
          extended = true;
          break;
        }
      }
    }

    // Extend backward
    extended = true;
    while (extended) {
      extended = false;
      const head = chain[0];
      for (let i = 0; i < segments.length; i++) {
        if (used.has(i)) continue;
        if (close(head, segments[i].end)) {
          chain.unshift(segments[i].start);
          used.add(i);
          extended = true;
          break;
        }
        if (close(head, segments[i].start)) {
          chain.unshift(segments[i].end);
          used.add(i);
          extended = true;
          break;
        }
      }
    }

    chains.push(chain);
  }

  return chains;
}

/** Dashed measurement line (5m/10m offset) rendered as tube for visibility */
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
    const vec3Points = points.map((p) => new THREE.Vector3(p.x, 0.08, p.y));
    return new THREE.BufferGeometry().setFromPoints(vec3Points);
  }, [points]);

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.computeLineDistances();
    }
  }, [geometry]);

  const labelPos: [number, number, number] = useMemo(
    () => (points.length > 0 ? [points[0].x, 0.15, points[0].y] : [0, 0, 0]),
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
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '11px',
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
function ReverseShadowLegend({ contourLines, minH, maxH }: { contourLines: ContourLine[]; minH: number; maxH: number }) {
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
          background: 'rgba(15, 23, 42, 0.92)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '12px',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.3,
          pointerEvents: 'none',
          userSelect: 'none',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '13px' }}>逆日影ライン</div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>
          日影による最大高さ: {minH.toFixed(1)}m 〜 {maxH.toFixed(1)}m
        </div>
        {contourLines.map((cl, i) => (
          <div key={cl.height} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '4px',
                background: CONTOUR_COLORS[i % CONTOUR_COLORS.length],
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{cl.height}m</span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>({cl.segments.length}線分)</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReverseShadowOverlay({
  reverseShadow,
  showContours,
  showHeightmap,
  showMeasurementLines,
}: ReverseShadowOverlayProps) {
  // Compute min/max height for legend
  const { minH, maxH } = useMemo(() => {
    const field = reverseShadow.shadowHeightField;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < field.heights.length; i++) {
      if (field.insideMask[i] === 0) continue;
      if (field.heights[i] > 0 && field.heights[i] < min) min = field.heights[i];
      if (field.heights[i] > max) max = field.heights[i];
    }
    return { minH: isFinite(min) ? min : 0, maxH: isFinite(max) ? max : 0 };
  }, [reverseShadow]);

  return (
    <group>
      {showHeightmap && (
        <ShadowHeightmap field={reverseShadow.shadowHeightField} />
      )}

      {showContours && reverseShadow.contourLines.map((cl, i) => (
        <ContourLineDisplay key={cl.height} contour={cl} colorIndex={i} />
      ))}

      {showMeasurementLines && reverseShadow.line5m.length > 0 && (
        <MeasurementLine points={reverseShadow.line5m} color="#f59e0b" label="5mライン" />
      )}

      {showMeasurementLines && reverseShadow.line10m.length > 0 && (
        <MeasurementLine points={reverseShadow.line10m} color="#ef4444" label="10mライン" />
      )}

      {showContours && reverseShadow.contourLines.length > 0 && (
        <ReverseShadowLegend contourLines={reverseShadow.contourLines} minH={minH} maxH={maxH} />
      )}
    </group>
  );
}
