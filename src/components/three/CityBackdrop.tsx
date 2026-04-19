'use client';

import { useMemo } from 'react';
import type { SiteBoundary } from '@/engine/types';

interface CityBackdropProps {
  site: SiteBoundary | null;
  /** outer radius in meters around site centroid */
  radius?: number;
  /** inner radius to exclude (keep free around site) */
  innerRadius?: number;
  /** how many surrounding blocks */
  count?: number;
  /** deterministic seed so rebuilds don't jitter */
  seed?: number;
}

/**
 * Procedural surrounding city context: gray boxes around the site to mimic
 * the canonical VOLANS reference image. Placeholder until Phase 6 (PLATEAU).
 */
export function CityBackdrop({
  site,
  radius = 90,
  innerRadius = 22,
  count = 38,
  seed = 42,
}: CityBackdropProps) {
  const boxes = useMemo(() => {
    let cx = 0, cz = 0;
    if (site && site.vertices.length > 0) {
      let sx = 0, sy = 0;
      for (const v of site.vertices) {
        sx += v.x;
        sy += v.y;
      }
      cx = sx / site.vertices.length;
      cz = sy / site.vertices.length;
    }

    const rng = mulberry32(seed);
    const result: Array<{
      x: number;
      z: number;
      w: number;
      d: number;
      h: number;
      color: string;
    }> = [];
    let tries = 0;
    while (result.length < count && tries < count * 6) {
      tries++;
      const angle = rng() * Math.PI * 2;
      const r = innerRadius + rng() * (radius - innerRadius);
      const x = cx + Math.cos(angle) * r;
      const z = cz + Math.sin(angle) * r;
      const w = 4 + rng() * 8;
      const d = 4 + rng() * 8;
      const h = 6 + Math.pow(rng(), 1.5) * 32;
      const tint = 0.72 + rng() * 0.18;
      const gray = Math.floor(tint * 220 + 10);
      const color = `rgb(${gray},${gray + 4},${gray + 12})`;
      result.push({ x, z, w, d, h, color });
    }
    return result;
  }, [site, radius, innerRadius, count, seed]);

  return (
    <group>
      {boxes.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial
            color={b.color}
            roughness={0.85}
            metalness={0.02}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Deterministic tiny PRNG */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
