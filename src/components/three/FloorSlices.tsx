'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Point2D, HeightFieldData } from '@/engine/types';

interface FloorSlicesProps {
  footprint: Point2D[];
  floorHeights: number[];
  maxHeight: number;
  heightField: HeightFieldData | null;
}

type Segment = { start: Point2D; end: Point2D };

function extractFloorContour(field: HeightFieldData, elevation: number): Segment[] {
  const { cols, rows, originX, originY, resolution, heights, insideMask } = field;
  const segments: Segment[] = [];

  const interpolate = (a: number, b: number) => {
    const denom = b - a;
    if (Math.abs(denom) < 1e-10) return 0.5;
    return (elevation - a) / denom;
  };

  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const i00 = row * cols + col;
      const i10 = row * cols + (col + 1);
      const i01 = (row + 1) * cols + col;
      const i11 = (row + 1) * cols + (col + 1);

      // Keep floor contours strictly inside the legal buildable grid.
      if (
        insideMask[i00] === 0 ||
        insideMask[i10] === 0 ||
        insideMask[i01] === 0 ||
        insideMask[i11] === 0
      ) {
        continue;
      }

      const h00 = heights[i00];
      const h10 = heights[i10];
      const h01 = heights[i01];
      const h11 = heights[i11];

      const caseIdx =
        (h00 >= elevation ? 1 : 0) |
        (h10 >= elevation ? 2 : 0) |
        (h11 >= elevation ? 4 : 0) |
        (h01 >= elevation ? 8 : 0);

      if (caseIdx === 0 || caseIdx === 15) continue;

      const x0 = originX + col * resolution;
      const y0 = originY + row * resolution;
      const x1 = x0 + resolution;
      const y1 = y0 + resolution;

      const eb = (): Point2D => {
        const t = interpolate(h00, h10);
        return { x: x0 + t * resolution, y: y0 };
      };
      const er = (): Point2D => {
        const t = interpolate(h10, h11);
        return { x: x1, y: y0 + t * resolution };
      };
      const et = (): Point2D => {
        const t = interpolate(h01, h11);
        return { x: x0 + t * resolution, y: y1 };
      };
      const el = (): Point2D => {
        const t = interpolate(h00, h01);
        return { x: x0, y: y0 + t * resolution };
      };

      switch (caseIdx) {
        case 1: segments.push({ start: eb(), end: el() }); break;
        case 2: segments.push({ start: er(), end: eb() }); break;
        case 3: segments.push({ start: er(), end: el() }); break;
        case 4: segments.push({ start: et(), end: er() }); break;
        case 5:
          segments.push({ start: eb(), end: er() });
          segments.push({ start: et(), end: el() });
          break;
        case 6: segments.push({ start: et(), end: eb() }); break;
        case 7: segments.push({ start: et(), end: el() }); break;
        case 8: segments.push({ start: el(), end: et() }); break;
        case 9: segments.push({ start: eb(), end: et() }); break;
        case 10:
          segments.push({ start: eb(), end: el() });
          segments.push({ start: et(), end: er() });
          break;
        case 11: segments.push({ start: er(), end: et() }); break;
        case 12: segments.push({ start: el(), end: er() }); break;
        case 13: segments.push({ start: eb(), end: er() }); break;
        case 14: segments.push({ start: el(), end: eb() }); break;
      }
    }
  }

  return segments;
}

function createSegmentGeometry(segments: Segment[], elev: number): THREE.BufferGeometry | null {
  if (segments.length === 0) return null;
  const points: THREE.Vector3[] = [];
  for (const segment of segments) {
    points.push(
      new THREE.Vector3(segment.start.x, elev, segment.start.y),
      new THREE.Vector3(segment.end.x, elev, segment.end.y),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

function getContourLabelPosition(
  segments: Segment[],
  elevation: number,
  fallback: Point2D,
): [number, number, number] {
  if (segments.length === 0) {
    return [fallback.x, elevation + 0.1, fallback.y];
  }

  const points = segments.flatMap((segment) => [segment.start, segment.end]);
  const centroid = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return [
    centroid.x / points.length,
    elevation + 0.1,
    centroid.y / points.length,
  ];
}

function getFootprintCentroid(footprint: Point2D[]): Point2D {
  if (footprint.length === 0) return { x: 0, y: 0 };
  const total = footprint.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: total.x / footprint.length,
    y: total.y / footprint.length,
  };
}

export function FloorSlices({ footprint, floorHeights, maxHeight, heightField }: FloorSlicesProps) {
  const floorElevations = useMemo(() => {
    const elevations: number[] = [];
    let h = 0;
    for (const fh of floorHeights) {
      h += fh;
      if (h > maxHeight + 0.01) break;
      elevations.push(h);
    }
    return elevations;
  }, [floorHeights, maxHeight]);

  const footprintCentroid = useMemo(() => getFootprintCentroid(footprint), [footprint]);

  const fallbackPlateGeometry = useMemo(() => {
    if (footprint.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(footprint[0].x, footprint[0].y);
    for (let i = 1; i < footprint.length; i++) {
      shape.lineTo(footprint[i].x, footprint[i].y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [footprint]);

  const floorContours = useMemo(
    () => floorElevations.map((elev) => {
      const segments = heightField ? extractFloorContour(heightField, elev) : [];
      return {
        elev,
        segments,
        geometry: createSegmentGeometry(segments, elev),
      };
    }),
    [floorElevations, heightField],
  );

  if (floorElevations.length === 0 || (!heightField && !fallbackPlateGeometry)) return null;

  return (
    <group>
      {floorElevations.map((elev, i) => (
        <group key={i}>
          {heightField ? (
            floorContours[i]?.geometry ? (
              <lineSegments geometry={floorContours[i].geometry}>
                <lineBasicMaterial color="#14b8a6" transparent opacity={0.95} />
              </lineSegments>
            ) : null
          ) : fallbackPlateGeometry ? (
            <mesh geometry={fallbackPlateGeometry} position={[0, elev, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshBasicMaterial color="#5de4c7" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          ) : null}
          <Html
            position={
              heightField
                ? getContourLabelPosition(
                    floorContours[i]?.segments ?? [],
                    elev,
                    footprintCentroid,
                  )
                : [footprintCentroid.x, elev + 0.1, footprintCentroid.y]
            }
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: 'rgba(93, 228, 199, 0.75)', color: '#fff',
              padding: '1px 5px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {i + 1}F ({elev.toFixed(1)}m)
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
