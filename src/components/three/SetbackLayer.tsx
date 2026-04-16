'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface SetbackLayerProps {
  vertices: Float32Array;
  indices: Uint32Array;
  color: string;
  opacity?: number;
  renderOrder?: number;
}

function createGeometry(vertices: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function SetbackLayer({ vertices, indices, color, opacity = 0.35, renderOrder = 0 }: SetbackLayerProps) {
  const geometry = useMemo(() => createGeometry(vertices, indices), [vertices, indices]);

  return (
    <mesh geometry={geometry} renderOrder={renderOrder}>
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-renderOrder}
        polygonOffsetUnits={-renderOrder}
      />
    </mesh>
  );
}
