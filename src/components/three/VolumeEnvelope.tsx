'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { VolumeResult } from '@/engine/types';

interface VolumeEnvelopeProps {
  result: VolumeResult;
  layers: {
    road: boolean;
    adjacent: boolean;
    north: boolean;
    absoluteHeight: boolean;
    shadow: boolean;
  };
}

/** Layer color mapping for individual setback envelopes */
const LAYER_COLORS: Record<string, string> = {
  road: '#f59e0b',      // amber for road setback
  adjacent: '#10b981',  // emerald for adjacent setback
  north: '#8b5cf6',     // violet for north setback
  absoluteHeight: '#ef4444', // red for absolute height
  shadow: '#6366f1',    // indigo for shadow
};

/**
 * Creates a BufferGeometry from raw Float32Array vertices and Uint32Array indices.
 * Computes vertex normals for proper lighting.
 */
function createEnvelopeGeometry(
  vertices: Float32Array,
  indices: Uint32Array
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Renders a single envelope mesh with wireframe overlay */
function EnvelopeMesh({
  vertices,
  indices,
  color,
  opacity = 0.4,
  wireframeOpacity = 0.2,
}: {
  vertices: Float32Array;
  indices: Uint32Array;
  color: string;
  opacity?: number;
  wireframeOpacity?: number;
}) {
  const geometry = useMemo(
    () => createEnvelopeGeometry(vertices, indices),
    [vertices, indices]
  );

  // Clone geometry for wireframe to avoid shared state issues
  const wireframeGeometry = useMemo(() => geometry.clone(), [geometry]);

  return (
    <group>
      {/* Solid semi-transparent mesh */}
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe overlay */}
      <mesh geometry={wireframeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={wireframeOpacity}
          wireframe
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function VolumeEnvelope({ result, layers }: VolumeEnvelopeProps) {
  const hasMainEnvelope =
    result.envelopeVertices.length > 0 && result.envelopeIndices.length > 0;

  return (
    <group>
      {/* Main combined envelope */}
      {hasMainEnvelope && (
        <EnvelopeMesh
          vertices={result.envelopeVertices}
          indices={result.envelopeIndices}
          color="#3b82f6"
          opacity={0.35}
          wireframeOpacity={0.3}
        />
      )}

      {/* Individual setback layer envelopes */}
      {layers.road && result.setbackEnvelopes.road && (
        <EnvelopeMesh
          vertices={result.setbackEnvelopes.road.vertices}
          indices={result.setbackEnvelopes.road.indices}
          color={LAYER_COLORS.road}
          opacity={0.25}
          wireframeOpacity={0.15}
        />
      )}

      {layers.adjacent && result.setbackEnvelopes.adjacent && (
        <EnvelopeMesh
          vertices={result.setbackEnvelopes.adjacent.vertices}
          indices={result.setbackEnvelopes.adjacent.indices}
          color={LAYER_COLORS.adjacent}
          opacity={0.25}
          wireframeOpacity={0.15}
        />
      )}

      {layers.north && result.setbackEnvelopes.north && (
        <EnvelopeMesh
          vertices={result.setbackEnvelopes.north.vertices}
          indices={result.setbackEnvelopes.north.indices}
          color={LAYER_COLORS.north}
          opacity={0.25}
          wireframeOpacity={0.15}
        />
      )}

      {layers.absoluteHeight && result.setbackEnvelopes.absoluteHeight && (
        <EnvelopeMesh
          vertices={result.setbackEnvelopes.absoluteHeight.vertices}
          indices={result.setbackEnvelopes.absoluteHeight.indices}
          color={LAYER_COLORS.absoluteHeight}
          opacity={0.25}
          wireframeOpacity={0.15}
        />
      )}

      {layers.shadow && result.setbackEnvelopes.shadow && (
        <EnvelopeMesh
          vertices={result.setbackEnvelopes.shadow.vertices}
          indices={result.setbackEnvelopes.shadow.indices}
          color={LAYER_COLORS.shadow}
          opacity={0.25}
          wireframeOpacity={0.15}
        />
      )}
    </group>
  );
}
