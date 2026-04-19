'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

interface EnvelopeDashedProps {
  vertices: Float32Array;
  indices: Uint32Array;
  color: string;
  dashSize?: number;
  gapSize?: number;
  /** uniform scale around centroid (1 = identity) */
  scale?: number;
  opacity?: number;
}

/**
 * Renders the outline (edges) of an envelope mesh as dashed line segments.
 * Used for VOLANS canonical: slant envelope (red) and sky-factor envelope (green).
 */
export function EnvelopeDashed({
  vertices,
  indices,
  color,
  dashSize = 0.4,
  gapSize = 0.25,
  scale = 1,
  opacity = 0.9,
}: EnvelopeDashedProps) {
  const lineRef = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const base = new THREE.BufferGeometry();
    base.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    base.setIndex(new THREE.BufferAttribute(indices, 1));

    const edges = new THREE.EdgesGeometry(base, 18);

    if (scale !== 1) {
      // scale from centroid of positions
      const posAttr = edges.getAttribute('position') as THREE.BufferAttribute;
      let sx = 0, sz = 0, n = 0;
      for (let i = 0; i < posAttr.count; i++) {
        sx += posAttr.getX(i);
        sz += posAttr.getZ(i);
        n++;
      }
      const cx = n ? sx / n : 0;
      const cz = n ? sz / n : 0;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setX(i, (posAttr.getX(i) - cx) * scale + cx);
        posAttr.setZ(i, (posAttr.getZ(i) - cz) * scale + cz);
        posAttr.setY(i, posAttr.getY(i) * scale);
      }
      posAttr.needsUpdate = true;
    }

    base.dispose();
    return edges;
  }, [vertices, indices, scale]);

  useEffect(() => {
    // computeLineDistances is required for LineDashedMaterial
    lineRef.current?.computeLineDistances();
  }, [geometry]);

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineDashedMaterial
        color={color}
        dashSize={dashSize}
        gapSize={gapSize}
        linewidth={1.4}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </lineSegments>
  );
}
