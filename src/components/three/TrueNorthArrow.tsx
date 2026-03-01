'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SiteBoundary, Road } from '@/engine/types';
import { computeNorthRotation } from '@/engine';

interface TrueNorthArrowProps {
  site: SiteBoundary;
  roads: Road[];
}

export function TrueNorthArrow({ site, roads }: TrueNorthArrowProps) {
  const northData = useMemo(() => {
    const delta = computeNorthRotation(roads, site.vertices);
    if (delta === null) return null;

    // North direction in site coordinates
    const nx = -Math.sin(delta);
    const nz = Math.cos(delta);

    // Place arrow near top-right corner of site bounding box
    let maxX = -Infinity, maxY = -Infinity;
    for (const v of site.vertices) {
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }

    // Arrow origin: offset from site corner
    const ox = maxX + 2;
    const oz = maxY + 2;
    const arrowLen = 3;

    // Arrow shaft
    const shaft = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(ox, 0.05, oz),
      new THREE.Vector3(ox + nx * arrowLen, 0.05, oz + nz * arrowLen),
    ]);

    // Arrowhead (two short lines)
    const tipX = ox + nx * arrowLen;
    const tipZ = oz + nz * arrowLen;
    const headLen = 0.6;
    // Perpendicular to north direction
    const px = -nz;
    const pz = nx;
    const headPoints = [
      new THREE.Vector3(tipX, 0.05, tipZ),
      new THREE.Vector3(tipX - nx * headLen + px * headLen * 0.5, 0.05, tipZ - nz * headLen + pz * headLen * 0.5),
      new THREE.Vector3(tipX, 0.05, tipZ),
      new THREE.Vector3(tipX - nx * headLen - px * headLen * 0.5, 0.05, tipZ - nz * headLen - pz * headLen * 0.5),
    ];
    const head = new THREE.BufferGeometry().setFromPoints(headPoints);

    return {
      shaft,
      head,
      labelPos: [tipX + nx * 0.8, 0.3, tipZ + nz * 0.8] as [number, number, number],
      circleCenter: [ox, 0.04, oz] as [number, number, number],
      rotation: delta,
    };
  }, [site.vertices, roads]);

  if (!northData) return null;

  return (
    <group>
      {/* Arrow shaft */}
      <lineSegments geometry={northData.shaft}>
        <lineBasicMaterial color="#f87171" linewidth={2} />
      </lineSegments>
      {/* Arrowhead */}
      <lineSegments geometry={northData.head}>
        <lineBasicMaterial color="#f87171" linewidth={2} />
      </lineSegments>
      {/* "N" label */}
      <Html position={northData.labelPos} center style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#f87171',
          fontSize: '13px',
          fontWeight: 800,
          textShadow: '0 0 4px rgba(0,0,0,0.8)',
          fontFamily: 'system-ui, sans-serif',
        }}>
          N
        </div>
      </Html>
    </group>
  );
}
