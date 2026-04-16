'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SiteBoundary, Road, Point2D } from '@/engine/types';

interface SitePlaneProps {
  site: SiteBoundary;
  roads: Road[];
  buildablePolygon?: Point2D[] | null;
}

export function SitePlane({ site, roads, buildablePolygon }: SitePlaneProps) {
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

  const outlineGeometry = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const points = site.vertices.map((v) => new THREE.Vector3(v.x, 0.05, v.y));
    points.push(new THREE.Vector3(site.vertices[0].x, 0.05, site.vertices[0].y));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [site.vertices]);

  const glowOutlineGeometry = useMemo(() => {
    if (site.vertices.length < 3) return null;
    const points = site.vertices.map((v) => new THREE.Vector3(v.x, 0.04, v.y));
    points.push(new THREE.Vector3(site.vertices[0].x, 0.04, site.vertices[0].y));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [site.vertices]);

  const roadShapes = useMemo(() => {
    return roads.map((road) => {
      const dx = road.edgeEnd.x - road.edgeStart.x;
      const dy = road.edgeEnd.y - road.edgeStart.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return null;
      const bearingRad = (road.bearing * Math.PI) / 180;
      const nx = Math.sin(bearingRad);
      const ny = Math.cos(bearingRad);
      const shape = new THREE.Shape();
      shape.moveTo(road.edgeStart.x, road.edgeStart.y);
      shape.lineTo(road.edgeEnd.x, road.edgeEnd.y);
      shape.lineTo(road.edgeEnd.x + nx * road.width, road.edgeEnd.y + ny * road.width);
      shape.lineTo(road.edgeStart.x + nx * road.width, road.edgeStart.y + ny * road.width);
      shape.closePath();
      return shape;
    });
  }, [roads]);

  const buildableOutline = useMemo(() => {
    if (!buildablePolygon || buildablePolygon.length < 3) return null;
    const points = buildablePolygon.map((v) => new THREE.Vector3(v.x, 0.03, v.y));
    points.push(new THREE.Vector3(buildablePolygon[0].x, 0.03, buildablePolygon[0].y));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [buildablePolygon]);

  return (
    <group>
      {siteShape && (
        <mesh rotation-x={Math.PI / 2} position-y={0.01}>
          <shapeGeometry args={[siteShape]} />
          <meshStandardMaterial
            color="#5de4c7"
            roughness={0.9}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
      {glowOutlineGeometry && (
        <line>
          <bufferGeometry attach="geometry" {...glowOutlineGeometry} />
          <lineBasicMaterial color="#10b981" linewidth={3} transparent opacity={0.5} />
        </line>
      )}
      {outlineGeometry && (
        <line>
          <bufferGeometry attach="geometry" {...outlineGeometry} />
          <lineBasicMaterial color="#ffffff" linewidth={2} />
        </line>
      )}
      {site.vertices.map((v, i) => (
        <mesh key={`corner-${i}`} position={[v.x, 0.06, v.y]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {buildableOutline && (
        <line>
          <bufferGeometry attach="geometry" {...buildableOutline} />
          <lineBasicMaterial color="#f4b860" linewidth={1} transparent opacity={0.85} />
        </line>
      )}
      {roadShapes.map((shape, i) =>
        shape ? (
          <mesh key={`road-${i}`} rotation-x={Math.PI / 2} position-y={0.005}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.95}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ) : null
      )}
    </group>
  );
}
