'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SiteBoundary, ZoningData } from '@/engine/types';

interface FloorPlatesProps {
  site: SiteBoundary;
  zoning: ZoningData;
  floorHeights: number[];
  maxHeight: number;
  visible: boolean;
}

/**
 * Render semi-transparent floor plates at each floor level,
 * inset by wall setback distance.
 */
export function FloorPlates({
  site,
  zoning,
  floorHeights,
  maxHeight,
  visible,
}: FloorPlatesProps) {
  const wallSetback = zoning.wallSetback ?? 0;

  // Compute inset polygon (simple parallel offset)
  const insetVertices = useMemo(() => {
    const verts = site.vertices;
    const n = verts.length;
    if (n < 3) return verts;
    if (wallSetback <= 0) return verts;

    // Compute centroid
    let cx = 0, cy = 0;
    for (const v of verts) { cx += v.x; cy += v.y; }
    cx /= n; cy /= n;

    // Shrink each vertex toward centroid by wallSetback
    return verts.map((v) => {
      const dx = v.x - cx;
      const dy = v.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= wallSetback) return { x: cx, y: cy };
      const scale = (dist - wallSetback) / dist;
      return { x: cx + dx * scale, y: cy + dy * scale };
    });
  }, [site.vertices, wallSetback]);

  // Build floor elevations from floorHeights array
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

  // Create a single Shape for all plates
  const plateShape = useMemo(() => {
    if (insetVertices.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(insetVertices[0].x, insetVertices[0].y);
    for (let i = 1; i < insetVertices.length; i++) {
      shape.lineTo(insetVertices[i].x, insetVertices[i].y);
    }
    shape.closePath();
    return shape;
  }, [insetVertices]);

  const plateGeometry = useMemo(() => {
    if (!plateShape) return null;
    return new THREE.ShapeGeometry(plateShape);
  }, [plateShape]);

  if (!visible || floorElevations.length === 0 || !plateGeometry) return null;

  return (
    <group>
      {floorElevations.map((elev, i) => (
        <group key={i}>
          {/* Floor plate */}
          <mesh
            geometry={plateGeometry}
            position={[0, elev, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              color="#60a5fa"
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          {/* Floor label */}
          <Html
            position={[insetVertices[0].x, elev + 0.1, insetVertices[0].y]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                background: 'rgba(96, 165, 250, 0.75)',
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {i + 1}F ({elev.toFixed(1)}m)
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
