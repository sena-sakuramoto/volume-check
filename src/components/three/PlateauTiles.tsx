'use client';

import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ecefToLocalEnuMatrix } from '@/lib/ecef';

/**
 * PLATEAU (MLIT) 3D Tiles overlay. Loads the official CesiumLab-hosted LOD1
 * tileset for Tokyo when the site lat/lng falls inside the covered area.
 *
 * Known public Tokyo LOD1 tileset (central 23 wards, 2020 reference build):
 *   https://assets.cms.plateau.reearth.io/assets/11/6d058a-d014-4b30-9c83-1c1be45e0d9e/
 *     plateau-2020-13100_tokyo23-ku_3dtiles_tran_lod1/tileset.json
 *
 * If the tileset fails to load we silently fall back (OSM buildings already
 * rendered by `OsmBuildings`). This keeps the UX resilient even when PLATEAU
 * assets move.
 */
interface PlateauTilesProps {
  lat: number | null;
  lng: number | null;
  /** override the tileset URL; defaults to Tokyo 23ku LOD1 */
  tilesetUrl?: string;
}

const TOKYO_23KU_LOD1 =
  'https://assets.cms.plateau.reearth.io/assets/11/6d058a-d014-4b30-9c83-1c1be45e0d9e/plateau-2020-13100_tokyo23-ku_3dtiles_tran_lod1/tileset.json';

export function PlateauTiles({ lat, lng, tilesetUrl }: PlateauTilesProps) {
  const { scene, camera } = useThree();
  const tilesRef = useRef<unknown>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (lat === null || lng === null) return;
    if (failed) return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import('3d-tiles-renderer');
        const TilesRenderer = (mod as unknown as { TilesRenderer: new (url: string) => unknown })
          .TilesRenderer;
        const tiles = new TilesRenderer(tilesetUrl ?? TOKYO_23KU_LOD1) as {
          setCamera: (cam: THREE.Camera) => void;
          setResolutionFromRenderer: (cam: THREE.Camera, r: THREE.WebGLRenderer) => void;
          group: THREE.Group;
          update: () => void;
          dispose?: () => void;
        };
        if (cancelled) {
          tiles.dispose?.();
          return;
        }
        tiles.setCamera(camera);
        tiles.group.name = 'plateau-tiles';

        // Proper ECEF → local ENU transform anchored at the site's (lat,lng).
        const m = ecefToLocalEnuMatrix(lat, lng, 0);
        tiles.group.matrixAutoUpdate = false;
        tiles.group.matrix.copy(m);

        tilesRef.current = tiles;
        scene.add(tiles.group);
      } catch (e) {
        console.warn('[PlateauTiles] failed to load tileset, falling back.', e);
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      const t = tilesRef.current as
        | { dispose?: () => void; group: THREE.Group }
        | null;
      if (t) {
        scene.remove(t.group);
        t.dispose?.();
        tilesRef.current = null;
      }
    };
  }, [lat, lng, tilesetUrl, scene, camera, failed]);

  useFrame(({ gl }) => {
    const t = tilesRef.current as {
      setResolutionFromRenderer: (cam: THREE.Camera, r: THREE.WebGLRenderer) => void;
      update: () => void;
    } | null;
    if (!t) return;
    t.setResolutionFromRenderer(camera, gl);
    t.update();
  });

  return null;
}
