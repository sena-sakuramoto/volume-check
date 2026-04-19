'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useVolansStore } from '@/stores/useVolansStore';
import type { SiteBoundary } from '@/engine/types';

interface OsmBuildingsProps {
  site: SiteBoundary | null;
  /** radius in meters around the geocoded center to fetch */
  radius?: number;
  /** max buildings to render (perf) */
  maxBuildings?: number;
}

interface BuildingMeshData {
  geometry: THREE.ExtrudeGeometry;
  color: string;
}

/**
 * Fetches real surrounding buildings from OSM via `/api/nearby-buildings`
 * and renders them as extruded gray footprints in the Three scene.
 *
 * Centered on the site centroid in local meters. Requires store.lat/lng for
 * lat/lng → local projection (same transform as site-shape's geo ring mapping).
 */
export function OsmBuildings({ site, radius = 200, maxBuildings = 150 }: OsmBuildingsProps) {
  const lat = useVolansStore((s) => s.lat);
  const lng = useVolansStore((s) => s.lng);
  const [meshes, setMeshes] = useState<BuildingMeshData[] | null>(null);

  useEffect(() => {
    if (lat === null || lng === null || !site || site.vertices.length < 3) {
      // Clear any stale meshes on a microtask so we don't call setState
      // synchronously inside the effect body.
      queueMicrotask(() => setMeshes((prev) => (prev === null ? prev : null)));
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch('/api/nearby-buildings', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ lat, lng, radiusMeters: radius }),
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          buildings?: Array<{ ring: [number, number][]; height: number }>;
        };
        if (cancelled || !data.buildings) return;

        // Projection: same as site-shape.ts — meters-per-degree with local origin
        const phi = (lat * Math.PI) / 180;
        const metersPerDegLat =
          111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
        const metersPerDegLng =
          111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);

        // Compute site centroid in lat/lng-local projection, matching
        // buildSiteFromGeoRing's shift (minX/minY -> origin).
        // site is already in local coords (post buildSiteFromGeoRing).
        // We need to know the geo-local anchor. We approximate by mapping
        // the site centroid (local) to (lat, lng) — the search center.
        let scx = 0,
          scy = 0;
        for (const v of site.vertices) {
          scx += v.x;
          scy += v.y;
        }
        scx /= site.vertices.length;
        scy /= site.vertices.length;

        const picked = data.buildings.slice(0, maxBuildings);
        const next: BuildingMeshData[] = [];
        for (let idx = 0; idx < picked.length; idx++) {
          const b = picked[idx];
          if (b.ring.length < 3) continue;
          // Project ring lng/lat to meters relative to (lat, lng) center
          const pts: THREE.Vector2[] = [];
          let cx = 0,
            cz = 0;
          for (const [ln, la] of b.ring) {
            const x = (ln - lng) * metersPerDegLng;
            const z = -(la - lat) * metersPerDegLat;
            pts.push(new THREE.Vector2(x, z));
            cx += x;
            cz += z;
          }
          if (pts.length < 3) continue;

          const centerDist = Math.hypot(cx / pts.length, cz / pts.length);
          if (centerDist < 12) continue;

          const shape = new THREE.Shape(pts);
          const h = Math.max(3, b.height);
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: h,
            bevelEnabled: false,
          });
          geometry.rotateX(-Math.PI / 2);
          geometry.translate(scx, 0, scy);

          // Color variance: taller → slightly cooler, shorter → warmer cream;
          // a small per-index jitter keeps the skyline interesting without looking random.
          const heightFactor = Math.min(1, h / 60);
          const jitter = ((idx * 37) % 17) - 8; // -8..+8
          const base = 198 + jitter;
          const r = Math.round(base - heightFactor * 12);
          const g = Math.round(base - heightFactor * 6);
          const blu = Math.round(base + heightFactor * 14);
          const color = `rgb(${Math.max(160, Math.min(r, 220))},${Math.max(160, Math.min(g, 225))},${Math.max(170, Math.min(blu, 235))})`;
          next.push({ geometry, color });
        }
        setMeshes(next);
      } catch {
        // silent
      }
    })();

    return () => {
      cancelled = true;
      // dispose old geometries
      setMeshes((prev) => {
        if (prev) for (const m of prev) m.geometry.dispose();
        return null;
      });
    };
  }, [lat, lng, site, radius, maxBuildings]);

  if (!meshes) return null;

  return (
    <group>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geometry}>
          <meshStandardMaterial
            color={m.color}
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
