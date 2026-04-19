'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface EnvelopeMeshProps {
  vertices: Float32Array;
  indices: Uint32Array;
  color?: string;
  roughness?: number;
  metalness?: number;
}

function createGeometry(vertices: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function EnvelopeMesh({
  vertices,
  indices,
  color = '#e8eaed',
  roughness = 0.6,
  metalness = 0.05,
}: EnvelopeMeshProps) {
  const geometry = useMemo(() => createGeometry(vertices, indices), [vertices, indices]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        side={THREE.FrontSide}
        envMapIntensity={0.8}
      />
    </mesh>
  );
}
