'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SiteBoundary, Road } from '@/engine/types';

interface SiteGroundProps {
  site: SiteBoundary;
  roads: Road[];
}

export function SiteGround({ site, roads }: SiteGroundProps) {
  // Build the site polygon shape (on XY plane, will be rotated to XZ)
  const siteShape = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(site.vertices[0].x, site.vertices[0].y);
    for (let i = 1; i < site.vertices.length; i++) {
      shape.lineTo(site.vertices[i].x, site.vertices[i].y);
    }
    shape.closePath();
    return shape;
  }, [site.vertices]);

  // Build site outline geometry as a line loop
  const outlineGeometry = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const points: THREE.Vector3[] = site.vertices.map(
      (v) => new THREE.Vector3(v.x, 0.02, v.y)
    );
    // Close the loop
    points.push(new THREE.Vector3(site.vertices[0].x, 0.02, site.vertices[0].y));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [site.vertices]);

  // Build road surface shapes
  const roadShapes = useMemo(() => {
    return roads.map((road) => {
      // Road edge direction vector
      const dx = road.edgeEnd.x - road.edgeStart.x;
      const dy = road.edgeEnd.y - road.edgeStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return null;

      // Normalize edge direction
      const ex = dx / len;
      const ey = dy / len;

      // Outward normal: perpendicular to edge, pointing away from site
      // bearing 0=N, 90=E, 180=S, 270=W → standard (sin, cos) conversion
      const bearingRad = (road.bearing * Math.PI) / 180;
      const nx = Math.sin(bearingRad);
      const ny = Math.cos(bearingRad);

      // Four corners of the road rectangle:
      // Bottom-left and bottom-right are on the site edge
      // Top-left and top-right extend outward by road.width
      const shape = new THREE.Shape();
      shape.moveTo(road.edgeStart.x, road.edgeStart.y);
      shape.lineTo(road.edgeEnd.x, road.edgeEnd.y);
      shape.lineTo(
        road.edgeEnd.x + nx * road.width,
        road.edgeEnd.y + ny * road.width
      );
      shape.lineTo(
        road.edgeStart.x + nx * road.width,
        road.edgeStart.y + ny * road.width
      );
      shape.closePath();
      return shape;
    });
  }, [roads]);

  return (
    <group>
      {/* Site fill polygon */}
      {siteShape && (
        <mesh rotation-x={Math.PI / 2} position-y={0.01}>
          <shapeGeometry args={[siteShape]} />
          <meshBasicMaterial
            color="#3b82f6"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Site outline */}
      {outlineGeometry && (
        <line>
          <bufferGeometry attach="geometry" {...outlineGeometry} />
          <lineBasicMaterial color="#2563eb" linewidth={2} />
        </line>
      )}

      {/* Road surfaces */}
      {roadShapes.map((shape, i) =>
        shape ? (
          <mesh key={`road-${i}`} rotation-x={Math.PI / 2} position-y={0.005}>
            <shapeGeometry args={[shape]} />
            <meshBasicMaterial
              color="#9ca3af"
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : null
      )}
    </group>
  );
}
