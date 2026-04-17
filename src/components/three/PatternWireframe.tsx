'use client';

import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { PatternResult } from '@/engine/types';

interface PatternWireframeProps {
  pattern: PatternResult;
  color: string;
  opacity?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getFootprintCentroid(footprint: PatternResult['footprint']) {
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let i = 0; i < footprint.length; i++) {
    const current = footprint[i];
    const next = footprint[(i + 1) % footprint.length];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }

  if (Math.abs(signedArea) < 1e-6) {
    const average = footprint.reduce(
      (acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        return acc;
      },
      { x: 0, y: 0 },
    );

    return {
      x: average.x / footprint.length,
      y: average.y / footprint.length,
    };
  }

  const areaFactor = signedArea * 3;
  return {
    x: centroidX / areaFactor,
    y: centroidY / areaFactor,
  };
}

export function PatternWireframe({ pattern, color, opacity = 0.2 }: PatternWireframeProps) {
  const geometry = useMemo(() => {
    if (!pattern.footprint || pattern.footprint.length < 3 || pattern.maxHeight <= 0) {
      return null;
    }

    const footprint = pattern.footprint;
    const maxHeight = pattern.maxHeight;

    const shape = new THREE.Shape();
    shape.moveTo(footprint[0].x, footprint[0].y);
    for (let i = 1; i < footprint.length; i++) {
      shape.lineTo(footprint[i].x, footprint[i].y);
    }
    shape.closePath();

    const faceGeometry = new THREE.ShapeGeometry(shape);

    const sidePositions: number[] = [];
    const edgePositions: number[] = [];

    for (let i = 0; i < footprint.length; i++) {
      const next = (i + 1) % footprint.length;
      const currentPoint = footprint[i];
      const nextPoint = footprint[next];

      const bottomLeft = new THREE.Vector3(currentPoint.x, 0, currentPoint.y);
      const bottomRight = new THREE.Vector3(nextPoint.x, 0, nextPoint.y);
      const topRight = new THREE.Vector3(nextPoint.x, maxHeight, nextPoint.y);
      const topLeft = new THREE.Vector3(currentPoint.x, maxHeight, currentPoint.y);

      sidePositions.push(
        bottomLeft.x, bottomLeft.y, bottomLeft.z,
        bottomRight.x, bottomRight.y, bottomRight.z,
        topRight.x, topRight.y, topRight.z,
        bottomLeft.x, bottomLeft.y, bottomLeft.z,
        topRight.x, topRight.y, topRight.z,
        topLeft.x, topLeft.y, topLeft.z,
      );

      edgePositions.push(
        bottomLeft.x, bottomLeft.y, bottomLeft.z,
        bottomRight.x, bottomRight.y, bottomRight.z,
        topLeft.x, topLeft.y, topLeft.z,
        topRight.x, topRight.y, topRight.z,
        bottomLeft.x, bottomLeft.y, bottomLeft.z,
        topLeft.x, topLeft.y, topLeft.z,
      );
    }

    const sideGeometry = new THREE.BufferGeometry();
    sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sidePositions, 3));
    sideGeometry.computeBoundingSphere();

    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    edgeGeometry.computeBoundingSphere();

    return {
      centroid: getFootprintCentroid(footprint),
      edgeGeometry,
      faceGeometry,
      sideGeometry,
    };
  }, [pattern]);

  useEffect(() => {
    return () => {
      geometry?.faceGeometry.dispose();
      geometry?.sideGeometry.dispose();
      geometry?.edgeGeometry.dispose();
    };
  }, [geometry]);

  if (!geometry) {
    return null;
  }

  return (
    <group>
      <mesh geometry={geometry.faceGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, pattern.maxHeight, 0]}>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={opacity}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>

      <mesh geometry={geometry.faceGeometry} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={opacity}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>

      <mesh geometry={geometry.sideGeometry}>
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={opacity}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>

      <lineSegments geometry={geometry.edgeGeometry}>
        <lineBasicMaterial color={color} opacity={Math.min(opacity * 3.5, 1)} transparent />
      </lineSegments>

      {opacity > 0.1 && (
        <Html position={[geometry.centroid.x, pattern.maxHeight + 0.5, geometry.centroid.y]} center>
          <div
            style={{
              background: hexToRgba(color, 0.85),
              borderRadius: 4,
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: 1.3,
              padding: '4px 6px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <div>{pattern.name}</div>
            <div>{`${pattern.maxFloors}F / ${pattern.maxHeight.toFixed(1)}m`}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
