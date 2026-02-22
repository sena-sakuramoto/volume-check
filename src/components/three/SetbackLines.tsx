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

const SAMPLE_COUNT = 5;
const ABSOLUTE_MAX = 60;

/** Sample evenly spaced points along an edge, inset 10% from ends */
function sampleEdge(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  count: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= count; i++) {
    const t = 0.1 + (i / Math.max(count, 1)) * 0.8;
    pts.push({ x: sx + (ex - sx) * t, y: sy + (ey - sy) * t });
  }
  return pts;
}

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

  // ── Road setback slope lines (道路斜線) ──
  const roadSlopeData = useMemo(() => {
    if (!layers.road || roads.length === 0) return null;

    const points: THREE.Vector3[] = [];

    for (const road of roads) {
      const bearingRad = (road.bearing * Math.PI) / 180;
      // Direction FROM road INTO site (opposite of bearing)
      const inX = -Math.sin(bearingRad);
      const inY = -Math.cos(bearingRad);

      const samples = sampleEdge(
        road.edgeStart.x,
        road.edgeStart.y,
        road.edgeEnd.x,
        road.edgeEnd.y,
        SAMPLE_COUNT,
      );

      for (const pt of samples) {
        // Road opposite boundary (far side of road)
        const oppX = pt.x - inX * road.width;
        const oppY = pt.y - inY * road.width;

        // Start: road opposite boundary at ground
        // Three.js: (X=engineX, Y=height, Z=engineY)
        points.push(new THREE.Vector3(oppX, 0, oppY));

        // End: extend into site until hitting absLimit or 25m horizontal
        const maxH = Math.min(absLimit + 2, ABSOLUTE_MAX);
        const maxDist = maxH / roadParams.slopeRatio;
        const endX = oppX + inX * maxDist;
        const endY = oppY + inY * maxDist;
        const endH = roadParams.slopeRatio * maxDist;
        points.push(new THREE.Vector3(endX, endH, endY));
      }
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [roads, roadParams, absLimit, layers.road]);

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
    const northSiteEdges = getNorthEdges(nonRoadEdges, site.vertices);

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

  // ── North setback slope lines (北側斜線) ──
  const northSlopeData = useMemo(() => {
    if (!layers.north || !northParams || northEdgesList.length === 0) return null;

    const points: THREE.Vector3[] = [];

    for (const edge of northEdgesList) {
      const samples = sampleEdge(edge.sx, edge.sy, edge.ex, edge.ey, SAMPLE_COUNT);

      for (const pt of samples) {
        // Start at north edge at riseHeight
        points.push(new THREE.Vector3(pt.x, northParams.riseHeight, pt.y));

        // Extend inward until hitting absLimit
        const remainH = absLimit - northParams.riseHeight;
        if (remainH <= 0) continue;
        const maxDist = remainH / northParams.slopeRatio;
        const endH = northParams.riseHeight + northParams.slopeRatio * maxDist;
        points.push(
          new THREE.Vector3(
            pt.x + edge.inX * maxDist,
            endH,
            pt.y + edge.inY * maxDist,
          ),
        );
      }
    }

    if (points.length === 0) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [northEdgesList, northParams, absLimit, layers.north]);

  // ── Adjacent setback slope lines (隣地斜線) ──
  const adjSlopeData = useMemo(() => {
    if (!layers.adjacent || adjacentEdgesList.length === 0) return null;
    // Don't draw if riseHeight already exceeds absLimit (not constraining)
    if (adjParams.riseHeight >= absLimit) return null;

    const points: THREE.Vector3[] = [];

    for (const edge of adjacentEdgesList) {
      const samples = sampleEdge(
        edge.sx,
        edge.sy,
        edge.ex,
        edge.ey,
        Math.min(SAMPLE_COUNT, 3),
      );

      for (const pt of samples) {
        points.push(new THREE.Vector3(pt.x, adjParams.riseHeight, pt.y));
        const remainH = absLimit - adjParams.riseHeight;
        if (remainH <= 0) continue;
        const maxDist = remainH / adjParams.slopeRatio;
        const endH = adjParams.riseHeight + adjParams.slopeRatio * maxDist;
        points.push(
          new THREE.Vector3(
            pt.x + edge.inX * maxDist,
            endH,
            pt.y + edge.inY * maxDist,
          ),
        );
      }
    }

    if (points.length === 0) return null;
    return new THREE.BufferGeometry().setFromPoints(points);
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
      {/* Road setback slope lines */}
      {roadSlopeData && (
        <lineSegments geometry={roadSlopeData}>
          <lineBasicMaterial color="#f59e0b" linewidth={2} transparent opacity={0.9} />
        </lineSegments>
      )}

      {/* North setback slope lines */}
      {northSlopeData && (
        <lineSegments geometry={northSlopeData}>
          <lineBasicMaterial color="#8b5cf6" linewidth={2} transparent opacity={0.9} />
        </lineSegments>
      )}

      {/* Adjacent setback slope lines */}
      {adjSlopeData && (
        <lineSegments geometry={adjSlopeData}>
          <lineBasicMaterial color="#10b981" linewidth={2} transparent opacity={0.9} />
        </lineSegments>
      )}

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

      {/* North setback label */}
      {layers.north && northParams && northEdgesList.length > 0 && (
        <Html
          position={[
            (northEdgesList[0].sx + northEdgesList[0].ex) / 2,
            northParams.riseHeight + 0.5,
            (northEdgesList[0].sy + northEdgesList[0].ey) / 2,
          ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.85)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            北側斜線 {northParams.riseHeight}m+1.25D
          </div>
        </Html>
      )}

      {/* Road setback label */}
      {layers.road && roads.length > 0 && (
        <Html
          position={[
            (roads[0].edgeStart.x + roads[0].edgeEnd.x) / 2,
            1,
            (roads[0].edgeStart.y + roads[0].edgeEnd.y) / 2,
          ]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.85)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            道路斜線 {roadParams.slopeRatio}D
          </div>
        </Html>
      )}
    </group>
  );
}
