'use client';

import { useMemo } from 'react';
import type { PatternResult } from '@/engine/types';

interface PatternWireframeProps {
  pattern: PatternResult;
  color: string;
}

export function PatternWireframe({ pattern, color }: PatternWireframeProps) {
  const geometry = useMemo(() => {
    if (!pattern.footprint || pattern.footprint.length < 3 || pattern.maxHeight <= 0) return null;

    const fp = pattern.footprint;
    const h = pattern.maxHeight;
    const n = fp.length;
    const points: number[] = [];

    for (let i = 0; i < n; i++) {
      const a = fp[i];
      const b = fp[(i + 1) % n];
      points.push(a.x, 0, a.y, b.x, 0, b.y);
    }
    for (let i = 0; i < n; i++) {
      const a = fp[i];
      const b = fp[(i + 1) % n];
      points.push(a.x, h, a.y, b.x, h, b.y);
    }
    for (let i = 0; i < n; i++) {
      const v = fp[i];
      points.push(v.x, 0, v.y, v.x, h, v.y);
    }

    return new Float32Array(points);
  }, [pattern]);

  if (!geometry) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
    </lineSegments>
  );
}
