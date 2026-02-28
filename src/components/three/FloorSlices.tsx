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
