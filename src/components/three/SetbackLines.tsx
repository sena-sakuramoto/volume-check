'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
  getSiteEdges,
  isRoadEdge,
  getNorthEdges,
} from '@/engine';

interface SetbackLinesProps {
  site: SiteBoundary;
  roads: Road[];
  zoning: ZoningData;
  layers: {
    road: boolean;
    adjacent: boolean;
    north: boolean;
    absoluteHeight: boolean;
  };
}

const ABSOLUTE_MAX = 60;

type Vec3 = [number, number, number];

type RenderedSlope = {
  key: string;
  surfaceGeometry: THREE.BufferGeometry;
  sectionGeometry: THREE.BufferGeometry;
  labelPosition: Vec3;
  labelText: string;
  surfaceColor: string;
  surfaceOpacity: number;
  labelBackground: string;
};

/** Signed area: positive = CCW */
function signedArea(verts: Array<{ x: number; y: number }>): number {
  let a = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    a += verts[i].x * verts[j].y - verts[j].x * verts[i].y;
  }
  return a / 2;
}

function createIndexedGeometry(vertices: number[], indices: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  const vertexCount = vertices.length / 3;
  const indexArray =
    vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  return geometry;
}

function createQuadGeometry(v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3): THREE.BufferGeometry {
  return createIndexedGeometry(
    [...v0, ...v1, ...v2, ...v3],
    [0, 1, 2, 0, 2, 3],
  );
}

function createLineGeometry(start: Vec3, end: Vec3): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([...start, ...end]), 3),
  );
  return geometry;
}

function getSurfaceMidpoint(v0: Vec3, v1: Vec3, v2: Vec3, v3: Vec3): Vec3 {
  return [
    (v0[0] + v1[0] + v2[0] + v3[0]) / 4,
    (v0[1] + v1[1] + v2[1] + v3[1]) / 4,
    (v0[2] + v1[2] + v2[2] + v3[2]) / 4,
  ];
}

export function SetbackLines({ site, roads, zoning, layers }: SetbackLinesProps) {
  const roadParams = useMemo(
    () => getRoadSetbackParams(zoning.district),
    [zoning.district],
  );
  const northParams = useMemo(
    () => getNorthSetbackParams(zoning.district),
    [zoning.district],
  );
  const adjParams = useMemo(
    () => getAdjacentSetbackParams(zoning.district),
    [zoning.district],
  );

  const absLimit = zoning.absoluteHeightLimit ?? ABSOLUTE_MAX;
  const isCCW = useMemo(() => signedArea(site.vertices) > 0, [site.vertices]);

  // ── Road setback slope surfaces (道路斜線) ──
  const roadSlopeData = useMemo(() => {
    if (!layers.road || roads.length === 0 || roadParams.slopeRatio <= 0) return [];

    const maxH = Math.min(absLimit + 2, ABSOLUTE_MAX);
    const maxDist = maxH / roadParams.slopeRatio;

    return roads.map((road, index) => {
      const bearingRad = (road.bearing * Math.PI) / 180;
      const inX = -Math.sin(bearingRad);
      const inY = -Math.cos(bearingRad);

      const v0: Vec3 = [
        road.edgeStart.x - inX * road.width,
        0,
        road.edgeStart.y - inY * road.width,
      ];
      const v1: Vec3 = [
        road.edgeEnd.x - inX * road.width,
        0,
        road.edgeEnd.y - inY * road.width,
      ];
      const v2: Vec3 = [v1[0] + inX * maxDist, maxH, v1[2] + inY * maxDist];
      const v3: Vec3 = [v0[0] + inX * maxDist, maxH, v0[2] + inY * maxDist];

      const midBottomX = (v0[0] + v1[0]) / 2;
      const midBottomZ = (v0[2] + v1[2]) / 2;
      const sectionStart: Vec3 = [midBottomX, 0, midBottomZ];
      const sectionEnd: Vec3 = [
        midBottomX + inX * maxDist,
        maxH,
        midBottomZ + inY * maxDist,
      ];

      return {
        key: `road-${index}`,
        surfaceGeometry: createQuadGeometry(v0, v1, v2, v3),
        sectionGeometry: createLineGeometry(sectionStart, sectionEnd),
        labelPosition: getSurfaceMidpoint(v0, v1, v2, v3),
        labelText: `道路斜線 ${roadParams.slopeRatio}D`,
        surfaceColor: '#f59e0b',
        surfaceOpacity: 0.15,
        labelBackground: 'rgba(245, 158, 11, 0.85)',
      } satisfies RenderedSlope;
    });
  }, [roads, roadParams.slopeRatio, absLimit, layers.road]);

  // ── Identify non-road edges → north vs adjacent (using engine functions) ──
  const { northEdgesList, adjacentEdgesList } = useMemo(() => {
    type Edge = {
      sx: number;
      sy: number;
      ex: number;
      ey: number;
      inX: number;
      inY: number;
    };

    const allEdges = getSiteEdges(site.vertices);
    const nonRoadEdges = allEdges.filter((e) => !isRoadEdge(e, roads));
    const northSiteEdges = getNorthEdges(nonRoadEdges, site.vertices, roads);

    // Build Edge objects with inward normals for rendering
    const toRenderEdge = (se: { start: { x: number; y: number }; end: { x: number; y: number } }): Edge => {
      const dx = se.end.x - se.start.x;
      const dy = se.end.y - se.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const inX = len > 0 ? (isCCW ? -dy / len : dy / len) : 0;
      const inY = len > 0 ? (isCCW ? dx / len : -dx / len) : 0;
      return { sx: se.start.x, sy: se.start.y, ex: se.end.x, ey: se.end.y, inX, inY };
    };

    const northSet = new Set(northSiteEdges);
    const adjacentSiteEdges = nonRoadEdges.filter((e) => !northSet.has(e));

    return {
      northEdgesList: northSiteEdges.map(toRenderEdge),
      adjacentEdgesList: adjacentSiteEdges.map(toRenderEdge),
    };
  }, [site.vertices, roads, isCCW]);

  // ── North setback slope surfaces (北側斜線) ──
  const northSlopeData = useMemo(() => {
    if (
      !layers.north ||
      !northParams ||
      northEdgesList.length === 0 ||
      northParams.slopeRatio <= 0
    ) {
      return [];
    }

    const remainH = absLimit - northParams.riseHeight;
    if (remainH <= 0) return [];

    const maxDist = remainH / northParams.slopeRatio;
    const maxH = northParams.riseHeight + northParams.slopeRatio * maxDist;

    return northEdgesList.map((edge, index) => {
      const v0: Vec3 = [edge.sx, northParams.riseHeight, edge.sy];
      const v1: Vec3 = [edge.ex, northParams.riseHeight, edge.ey];
      const v2: Vec3 = [edge.ex + edge.inX * maxDist, maxH, edge.ey + edge.inY * maxDist];
      const v3: Vec3 = [edge.sx + edge.inX * maxDist, maxH, edge.sy + edge.inY * maxDist];

      const midEdgeX = (edge.sx + edge.ex) / 2;
      const midEdgeY = (edge.sy + edge.ey) / 2;
      const sectionStart: Vec3 = [midEdgeX, northParams.riseHeight, midEdgeY];
      const sectionEnd: Vec3 = [
        midEdgeX + edge.inX * maxDist,
        maxH,
        midEdgeY + edge.inY * maxDist,
      ];

      return {
        key: `north-${index}`,
        surfaceGeometry: createQuadGeometry(v0, v1, v2, v3),
        sectionGeometry: createLineGeometry(sectionStart, sectionEnd),
        labelPosition: getSurfaceMidpoint(v0, v1, v2, v3),
        labelText: `北側斜線 ${northParams.riseHeight}m+${northParams.slopeRatio}D`,
        surfaceColor: '#8b5cf6',
        surfaceOpacity: 0.12,
        labelBackground: 'rgba(139, 92, 246, 0.85)',
      } satisfies RenderedSlope;
    });
  }, [northEdgesList, northParams, absLimit, layers.north]);

  // ── Adjacent setback slope surfaces (隣地斜線) ──
  const adjSlopeData = useMemo(() => {
    if (
      !layers.adjacent ||
      adjacentEdgesList.length === 0 ||
      adjParams.slopeRatio <= 0 ||
      adjParams.riseHeight >= absLimit
    ) {
      return [];
    }

    const remainH = absLimit - adjParams.riseHeight;
    if (remainH <= 0) return [];

    const maxDist = remainH / adjParams.slopeRatio;
    const maxH = adjParams.riseHeight + adjParams.slopeRatio * maxDist;

    return adjacentEdgesList.map((edge, index) => {
      const v0: Vec3 = [edge.sx, adjParams.riseHeight, edge.sy];
      const v1: Vec3 = [edge.ex, adjParams.riseHeight, edge.ey];
      const v2: Vec3 = [edge.ex + edge.inX * maxDist, maxH, edge.ey + edge.inY * maxDist];
      const v3: Vec3 = [edge.sx + edge.inX * maxDist, maxH, edge.sy + edge.inY * maxDist];

      const midEdgeX = (edge.sx + edge.ex) / 2;
      const midEdgeY = (edge.sy + edge.ey) / 2;
      const sectionStart: Vec3 = [midEdgeX, adjParams.riseHeight, midEdgeY];
      const sectionEnd: Vec3 = [
        midEdgeX + edge.inX * maxDist,
        maxH,
        midEdgeY + edge.inY * maxDist,
      ];

      return {
        key: `adjacent-${index}`,
        surfaceGeometry: createQuadGeometry(v0, v1, v2, v3),
        sectionGeometry: createLineGeometry(sectionStart, sectionEnd),
        labelPosition: getSurfaceMidpoint(v0, v1, v2, v3),
        labelText: `隣地斜線 ${adjParams.riseHeight}m+${adjParams.slopeRatio}D`,
        surfaceColor: '#10b981',
        surfaceOpacity: 0.12,
        labelBackground: 'rgba(16, 185, 129, 0.85)',
      } satisfies RenderedSlope;
    });
  }, [adjacentEdgesList, adjParams, absLimit, layers.adjacent]);

  // ── Absolute height limit frame (絶対高さ) ──
  const absHeightFrame = useMemo(() => {
    if (!layers.absoluteHeight || !zoning.absoluteHeightLimit) return null;

    const h = zoning.absoluteHeightLimit;
    const points: THREE.Vector3[] = [];
    const n = site.vertices.length;

    // Horizontal frame at height limit
    for (let i = 0; i < n; i++) {
      const v = site.vertices[i];
      const next = site.vertices[(i + 1) % n];
      points.push(new THREE.Vector3(v.x, h, v.y));
      points.push(new THREE.Vector3(next.x, h, next.y));
    }

    // Vertical corner lines
    for (const v of site.vertices) {
      points.push(new THREE.Vector3(v.x, 0, v.y));
      points.push(new THREE.Vector3(v.x, h, v.y));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [site.vertices, zoning.absoluteHeightLimit, layers.absoluteHeight]);

  // ── Labels ──
  const absH = zoning.absoluteHeightLimit;
  const siteCenterX = useMemo(
    () => site.vertices.reduce((s, v) => s + v.x, 0) / site.vertices.length,
    [site.vertices],
  );
  const siteCenterY = useMemo(
    () => site.vertices.reduce((s, v) => s + v.y, 0) / site.vertices.length,
    [site.vertices],
  );

  return (
    <group>
      {roadSlopeData.map((slope) => (
        <group key={slope.key}>
          <mesh geometry={slope.surfaceGeometry}>
            <meshBasicMaterial
              color={slope.surfaceColor}
              transparent
              opacity={slope.surfaceOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={slope.sectionGeometry}>
            <lineBasicMaterial color={slope.surfaceColor} linewidth={2} transparent opacity={0.9} />
          </lineSegments>
          <Html position={slope.labelPosition} center style={{ pointerEvents: 'none' }}>
            <div
              style={{
                background: slope.labelBackground,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {slope.labelText}
            </div>
          </Html>
        </group>
      ))}

      {northSlopeData.map((slope) => (
        <group key={slope.key}>
          <mesh geometry={slope.surfaceGeometry}>
            <meshBasicMaterial
              color={slope.surfaceColor}
              transparent
              opacity={slope.surfaceOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={slope.sectionGeometry}>
            <lineBasicMaterial color={slope.surfaceColor} linewidth={2} transparent opacity={0.9} />
          </lineSegments>
          <Html position={slope.labelPosition} center style={{ pointerEvents: 'none' }}>
            <div
              style={{
                background: slope.labelBackground,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {slope.labelText}
            </div>
          </Html>
        </group>
      ))}

      {adjSlopeData.map((slope) => (
        <group key={slope.key}>
          <mesh geometry={slope.surfaceGeometry}>
            <meshBasicMaterial
              color={slope.surfaceColor}
              transparent
              opacity={slope.surfaceOpacity}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineSegments geometry={slope.sectionGeometry}>
            <lineBasicMaterial color={slope.surfaceColor} linewidth={2} transparent opacity={0.9} />
          </lineSegments>
          <Html position={slope.labelPosition} center style={{ pointerEvents: 'none' }}>
            <div
              style={{
                background: slope.labelBackground,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {slope.labelText}
            </div>
          </Html>
        </group>
      ))}

      {/* Absolute height frame */}
      {absHeightFrame && (
        <lineSegments geometry={absHeightFrame}>
          <lineBasicMaterial color="#ef4444" linewidth={2} transparent opacity={0.8} />
        </lineSegments>
      )}

      {/* Height label */}
      {layers.absoluteHeight && absH && (
        <Html
          position={[siteCenterX, absH + 0.5, siteCenterY]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.85)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            絶対高さ {absH}m
          </div>
        </Html>
      )}
    </group>
  );
}
