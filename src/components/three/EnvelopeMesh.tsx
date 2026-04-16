'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface EnvelopeMeshProps {
  vertices: Float32Array;
  indices: Uint32Array;
  dimmed?: boolean;
}

function createGeometry(vertices: Float32Array, indices: Uint32Array): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

export function EnvelopeMesh({ vertices, indices, dimmed = false }: EnvelopeMeshProps) {
  const geometry = useMemo(() => createGeometry(vertices, indices), [vertices, indices]);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry, 15), [geometry]);

  return (
    <>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={dimmed ? '#94a3b8' : '#e8eaed'}
          roughness={0.6}
          metalness={0.05}
          transparent
          opacity={dimmed ? 0.15 : 0.92}
          side={THREE.DoubleSide}
          envMapIntensity={0.8}
          depthWrite={!dimmed}
        />
      </mesh>
      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.3} />
      </lineSegments>
    </>
  );
}
