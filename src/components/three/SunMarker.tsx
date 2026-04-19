'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

interface SunMarkerProps {
  /** Sun direction in radians (0 = south, π/2 = east etc). Default: upper-right */
  azimuthDeg?: number;
  elevationDeg?: number;
  distance?: number;
  size?: number;
  color?: string;
}

export function SunMarker({
  azimuthDeg = 135,
  elevationDeg = 55,
  distance = 70,
  size = 2.2,
  color = '#ffc24a',
}: SunMarkerProps) {
  const pos = useMemo(() => {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const r = distance;
    const x = r * Math.cos(el) * Math.sin(az);
    const z = r * Math.cos(el) * Math.cos(az);
    const y = r * Math.sin(el);
    return new THREE.Vector3(x, y, z);
  }, [azimuthDeg, elevationDeg, distance]);

  return (
    <group position={pos.toArray()}>
      <mesh>
        <sphereGeometry args={[size, 24, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight intensity={0.6} distance={250} color={color} />
    </group>
  );
}
