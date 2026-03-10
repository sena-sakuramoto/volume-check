'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SiteBoundary, Road, ZoningData } from '@/engine/types';
import {
  getRoadSetbackParams,
  getAdjacentSetbackParams,
  getNorthSetbackParams,
  getRoadRequiredFrontSetback,
  getRoadSlopeEffectiveWidth,
  getRoadSlopeHeightOffset,
  getRoadSlopeReferenceOffset,
  getRoadSlopeSetbackRelief,
  getRoadSlopeStartHeight,
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

function createSlopeSurfaceGeometry(
  quads: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]>,
): THREE.BufferGeometry | null {
  if (quads.length === 0) return null;

  const positions: number[] = [];
  const indices: number[] = [];

  for (const [a, b, c, d] of quads) {
    const offset = positions.length / 3;
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z,
      d.x, d.y, d.z,
    );
    indices.push(
      offset, offset + 2, offset + 1,
      offset + 1, offset + 2, offset + 3,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createLineGeometry(points: THREE.Vector3[]): THREE.BufferGeometry | null {
  if (points.length < 2) return null;
  return new THREE.BufferGeometry().setFromPoints(points);
}

type GuideLabel = {
  position: [number, number, number];
  text: string;
  background: string;
};

type RoadGuideVisual = {
  key: string;
  boundaryLine: THREE.BufferGeometry | null;
  frontLine: THREE.BufferGeometry | null;
  buildableLine: THREE.BufferGeometry | null;
  referenceLine: THREE.BufferGeometry | null;
  twoALimitLine: THREE.BufferGeometry | null;
  frontConnector: THREE.BufferGeometry | null;
  buildableConnector: THREE.BufferGeometry | null;
  referenceConnector: THREE.BufferGeometry | null;
  startHeightLine: THREE.BufferGeometry | null;
  labels: GuideLabel[];
};

type RenderEdge = {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  inX: number;
  inY: number;
};

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
  const { roadSlopeSurface, roadGuides } = useMemo(() => {
    if (!layers.road || roads.length === 0) {
      return { roadSlopeSurface: null, roadGuides: [] as RoadGuideVisual[] };
    }

    const quads: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];
    const guideVisuals: RoadGuideVisual[] = [];

    for (const [index, road] of roads.entries()) {
      const bearingRad = (road.bearing * Math.PI) / 180;
      // Direction FROM road INTO site (opposite of bearing)
      const inX = -Math.sin(bearingRad);
      const inY = -Math.cos(bearingRad);
      const requiredFrontSetback = getRoadRequiredFrontSetback(road);
      const wallSetback = Math.max(0, zoning.wallSetback ?? 0, zoning.districtPlan?.wallSetback ?? 0);
      const buildableOffset = requiredFrontSetback + wallSetback;
      const effectiveRoadWidth = getRoadSlopeEffectiveWidth(road);
      const setbackRelief = getRoadSlopeSetbackRelief(road, wallSetback);
      const referenceOffset = getRoadSlopeReferenceOffset(
        road,
        effectiveRoadWidth,
        setbackRelief,
      );
      const slopeHeightOffset = getRoadSlopeHeightOffset(road);
      const baseHeight = getRoadSlopeStartHeight(road, roadParams.slopeRatio, setbackRelief);
      const buildableHeight = Math.max(
        0,
        (buildableOffset + referenceOffset) * roadParams.slopeRatio + slopeHeightOffset,
      );
      const twoAZoneDepth =
        (road.enableTwoA35m === true)
          ? Math.min(effectiveRoadWidth * 2, 35, roadParams.applicationDistance)
          : 0;
      const groundStartOffset = Math.max(
        0,
        referenceOffset + slopeHeightOffset / roadParams.slopeRatio,
      );
      const guideY = 0.06;

      const boundaryA = new THREE.Vector3(road.edgeStart.x, guideY, road.edgeStart.y);
      const boundaryB = new THREE.Vector3(road.edgeEnd.x, guideY, road.edgeEnd.y);
      const frontGroundA = new THREE.Vector3(
        road.edgeStart.x + inX * requiredFrontSetback,
        guideY,
        road.edgeStart.y + inY * requiredFrontSetback,
      );
      const frontGroundB = new THREE.Vector3(
        road.edgeEnd.x + inX * requiredFrontSetback,
        guideY,
        road.edgeEnd.y + inY * requiredFrontSetback,
      );
      const buildableGroundA = new THREE.Vector3(
        road.edgeStart.x + inX * buildableOffset,
        guideY,
        road.edgeStart.y + inY * buildableOffset,
      );
      const buildableGroundB = new THREE.Vector3(
        road.edgeEnd.x + inX * buildableOffset,
        guideY,
        road.edgeEnd.y + inY * buildableOffset,
      );
      const referenceGroundA = new THREE.Vector3(
        road.edgeStart.x - inX * referenceOffset,
        guideY,
        road.edgeStart.y - inY * referenceOffset,
      );
      const referenceGroundB = new THREE.Vector3(
        road.edgeEnd.x - inX * referenceOffset,
        guideY,
        road.edgeEnd.y - inY * referenceOffset,
      );
      const twoALimitA = new THREE.Vector3(
        road.edgeStart.x + inX * twoAZoneDepth,
        guideY,
        road.edgeStart.y + inY * twoAZoneDepth,
      );
      const twoALimitB = new THREE.Vector3(
        road.edgeEnd.x + inX * twoAZoneDepth,
        guideY,
        road.edgeEnd.y + inY * twoAZoneDepth,
      );

      const startA = new THREE.Vector3(
        road.edgeStart.x + inX * requiredFrontSetback,
        baseHeight,
        road.edgeStart.y + inY * requiredFrontSetback,
      );
      const startB = new THREE.Vector3(
        road.edgeEnd.x + inX * requiredFrontSetback,
        baseHeight,
        road.edgeEnd.y + inY * requiredFrontSetback,
      );
      const groundStartA = new THREE.Vector3(
        road.edgeStart.x - inX * groundStartOffset,
        0,
        road.edgeStart.y - inY * groundStartOffset,
      );
      const groundStartB = new THREE.Vector3(
        road.edgeEnd.x - inX * groundStartOffset,
        0,
        road.edgeEnd.y - inY * groundStartOffset,
      );

      const maxH = Math.min(absLimit, ABSOLUTE_MAX);
      if (baseHeight >= maxH) continue;
      const maxDist = (maxH - baseHeight) / roadParams.slopeRatio;
      const endA = new THREE.Vector3(
        startA.x + inX * maxDist,
        maxH,
        startA.z + inY * maxDist,
      );
      const endB = new THREE.Vector3(
        startB.x + inX * maxDist,
        maxH,
        startB.z + inY * maxDist,
      );

      quads.push([groundStartA, groundStartB, endA, endB]);

      const boundaryMid = new THREE.Vector3(
        (boundaryA.x + boundaryB.x) / 2,
        guideY,
        (boundaryA.z + boundaryB.z) / 2,
      );
      const frontMid = new THREE.Vector3(
        (frontGroundA.x + frontGroundB.x) / 2,
        guideY,
        (frontGroundA.z + frontGroundB.z) / 2,
      );
      const buildableMid = new THREE.Vector3(
        (buildableGroundA.x + buildableGroundB.x) / 2,
        guideY,
        (buildableGroundA.z + buildableGroundB.z) / 2,
      );
      const referenceMid = new THREE.Vector3(
        (referenceGroundA.x + referenceGroundB.x) / 2,
        guideY,
        (referenceGroundA.z + referenceGroundB.z) / 2,
      );
      const startMid = new THREE.Vector3(
        (startA.x + startB.x) / 2,
        baseHeight,
        (startA.z + startB.z) / 2,
      );

      const labels: GuideLabel[] = [
        {
          position: [referenceMid.x, guideY + 0.2, referenceMid.z],
          text: `斜線基準 ${referenceOffset.toFixed(1)}m`,
          background: 'rgba(245, 158, 11, 0.92)',
        },
        {
          position: [startMid.x, startMid.y + 0.45, startMid.z],
          text: `開始高 ${baseHeight.toFixed(1)}m`,
          background: 'rgba(180, 83, 9, 0.92)',
        },
      ];

      if (requiredFrontSetback > 0.05) {
        labels.push({
          position: [
            (boundaryMid.x + frontMid.x) / 2,
            guideY + 0.2,
            (boundaryMid.z + frontMid.z) / 2,
          ],
          text: `後退 ${requiredFrontSetback.toFixed(1)}m`,
          background: 'rgba(14, 116, 144, 0.92)',
        });
      }

      if (buildableOffset > requiredFrontSetback + 0.05) {
        labels.push({
          position: [
            (frontMid.x + buildableMid.x) / 2,
            guideY + 0.2,
            (frontMid.z + buildableMid.z) / 2,
          ],
          text: `外壁後退 ${wallSetback.toFixed(1)}m`,
          background: 'rgba(13, 148, 136, 0.92)',
        });
        labels.push({
          position: [buildableMid.x, guideY + 0.2, buildableMid.z],
          text: `建築ライン高 ${buildableHeight.toFixed(1)}m`,
          background: 'rgba(15, 118, 110, 0.92)',
        });
      }

      if (setbackRelief > 0.05) {
        labels.push({
          position: [
            (referenceMid.x + boundaryMid.x) / 2,
            guideY + 0.55,
            (referenceMid.z + boundaryMid.z) / 2,
          ],
          text: `斜線緩和 ${setbackRelief.toFixed(1)}m`,
          background: 'rgba(217, 119, 6, 0.92)',
        });
      }

      if ((road.siteHeightAboveRoad ?? 0) > 0.05) {
        labels.push({
          position: [startMid.x, guideY + baseHeight / 2, startMid.z],
          text: `高低差 +${(road.siteHeightAboveRoad ?? 0).toFixed(1)}m`,
          background: 'rgba(127, 29, 29, 0.92)',
        });
      }

      if (twoAZoneDepth > 0.05) {
        labels.push({
          position: [
            (twoALimitA.x + twoALimitB.x) / 2,
            guideY + 0.2,
            (twoALimitA.z + twoALimitB.z) / 2,
          ],
          text: `2A/35m ${twoAZoneDepth.toFixed(1)}m`,
          background: 'rgba(99, 102, 241, 0.92)',
        });
      }

      guideVisuals.push({
        key: `road-guide-${index}`,
        boundaryLine: createLineGeometry([boundaryA, boundaryB]),
        frontLine: createLineGeometry([frontGroundA, frontGroundB]),
        buildableLine: createLineGeometry([buildableGroundA, buildableGroundB]),
        referenceLine: createLineGeometry([referenceGroundA, referenceGroundB]),
        twoALimitLine: twoAZoneDepth > 0.05 ? createLineGeometry([twoALimitA, twoALimitB]) : null,
        frontConnector:
          requiredFrontSetback > 0.05
            ? createLineGeometry([boundaryMid, frontMid])
            : null,
        buildableConnector:
          buildableOffset > requiredFrontSetback + 0.05
            ? createLineGeometry([frontMid, buildableMid])
            : null,
        referenceConnector:
          referenceOffset > 0.05
            ? createLineGeometry([boundaryMid, referenceMid])
            : null,
        startHeightLine: createLineGeometry([
          new THREE.Vector3(frontMid.x, guideY, frontMid.z),
          new THREE.Vector3(startMid.x, startMid.y, startMid.z),
        ]),
        labels,
      });
    }

    return {
      roadSlopeSurface: createSlopeSurfaceGeometry(quads),
      roadGuides: guideVisuals,
    };
  }, [roads, roadParams, absLimit, layers.road, zoning.wallSetback, zoning.districtPlan?.wallSetback]);

  // ── Identify non-road edges → north vs adjacent (using engine functions) ──
  const { northEdgesList, adjacentEdgesList } = useMemo(() => {
    const allEdges = getSiteEdges(site.vertices);
    const nonRoadEdges = allEdges.filter((e) => !isRoadEdge(e, roads));
    const northSiteEdges = getNorthEdges(nonRoadEdges, site.vertices, roads);

    // Build Edge objects with inward normals for rendering
    const toRenderEdge = (se: { start: { x: number; y: number }; end: { x: number; y: number } }): RenderEdge => {
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
  const northSlopeSurface = useMemo(() => {
    if (!layers.north || !northParams || northEdgesList.length === 0) return null;

    const quads: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];

    for (const edge of northEdgesList) {
      const remainH = absLimit - northParams.riseHeight;
      if (remainH <= 0) continue;
      const maxDist = remainH / northParams.slopeRatio;

      const startA = new THREE.Vector3(edge.sx, northParams.riseHeight, edge.sy);
      const startB = new THREE.Vector3(edge.ex, northParams.riseHeight, edge.ey);
      const endA = new THREE.Vector3(
        edge.sx + edge.inX * maxDist,
        absLimit,
        edge.sy + edge.inY * maxDist,
      );
      const endB = new THREE.Vector3(
        edge.ex + edge.inX * maxDist,
        absLimit,
        edge.ey + edge.inY * maxDist,
      );
      quads.push([startA, startB, endA, endB]);
    }

    return createSlopeSurfaceGeometry(quads);
  }, [northEdgesList, northParams, absLimit, layers.north]);

  // ── Adjacent setback slope lines (隣地斜線) ──
  const adjSlopeSurface = useMemo(() => {
    if (!layers.adjacent || adjacentEdgesList.length === 0) return null;
    // Don't draw if riseHeight already exceeds absLimit (not constraining)
    if (adjParams.riseHeight >= absLimit) return null;

    const quads: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];

    for (const edge of adjacentEdgesList) {
      const remainH = absLimit - adjParams.riseHeight;
      if (remainH <= 0) continue;
      const maxDist = remainH / adjParams.slopeRatio;

      const startA = new THREE.Vector3(edge.sx, adjParams.riseHeight, edge.sy);
      const startB = new THREE.Vector3(edge.ex, adjParams.riseHeight, edge.ey);
      const endA = new THREE.Vector3(
        edge.sx + edge.inX * maxDist,
        absLimit,
        edge.sy + edge.inY * maxDist,
      );
      const endB = new THREE.Vector3(
        edge.ex + edge.inX * maxDist,
        absLimit,
        edge.ey + edge.inY * maxDist,
      );
      quads.push([startA, startB, endA, endB]);
    }

    return createSlopeSurfaceGeometry(quads);
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
      {/* Road setback slope surface */}
      {roadSlopeSurface && (
        <mesh geometry={roadSlopeSurface}>
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={0.12}
            roughness={0.72}
            transparent
            opacity={0.22}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      {roadGuides.map((guide) => (
        <group key={guide.key}>
          {guide.boundaryLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.boundaryLine} />
              <lineBasicMaterial color="#fef3c7" transparent opacity={0.95} />
            </line>
          )}
          {guide.frontLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.frontLine} />
              <lineBasicMaterial color="#22d3ee" transparent opacity={0.92} />
            </line>
          )}
          {guide.referenceLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.referenceLine} />
              <lineBasicMaterial color="#f59e0b" transparent opacity={0.95} />
            </line>
          )}
          {guide.twoALimitLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.twoALimitLine} />
              <lineBasicMaterial color="#6366f1" transparent opacity={0.75} />
            </line>
          )}
          {guide.buildableLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.buildableLine} />
              <lineBasicMaterial color="#14b8a6" transparent opacity={0.92} />
            </line>
          )}
          {guide.frontConnector && (
            <line>
              <bufferGeometry attach="geometry" {...guide.frontConnector} />
              <lineBasicMaterial color="#38bdf8" transparent opacity={0.75} />
            </line>
          )}
          {guide.buildableConnector && (
            <line>
              <bufferGeometry attach="geometry" {...guide.buildableConnector} />
              <lineBasicMaterial color="#14b8a6" transparent opacity={0.78} />
            </line>
          )}
          {guide.referenceConnector && (
            <line>
              <bufferGeometry attach="geometry" {...guide.referenceConnector} />
              <lineBasicMaterial color="#fbbf24" transparent opacity={0.78} />
            </line>
          )}
          {guide.startHeightLine && (
            <line>
              <bufferGeometry attach="geometry" {...guide.startHeightLine} />
              <lineBasicMaterial color="#b45309" transparent opacity={0.8} />
            </line>
          )}
          {guide.labels.map((label) => (
            <Html
              key={`${guide.key}-${label.text}`}
              position={label.position}
              center
              style={{ pointerEvents: 'none' }}
            >
              <div
                style={{
                  background: label.background,
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {label.text}
              </div>
            </Html>
          ))}
        </group>
      ))}

      {/* North setback slope surface */}
      {northSlopeSurface && (
        <mesh geometry={northSlopeSurface}>
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={0.1}
            roughness={0.72}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      {/* Adjacent setback slope surface */}
      {adjSlopeSurface && (
        <mesh geometry={adjSlopeSurface}>
          <meshStandardMaterial
            color="#10b981"
            emissive="#10b981"
            emissiveIntensity={0.1}
            roughness={0.72}
            transparent
            opacity={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
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
      {layers.road && roads.map((road, index) => (
        <Html
          key={`road-label-${index}`}
          position={[
            (road.edgeStart.x + road.edgeEnd.x) / 2,
            1,
            (road.edgeStart.y + road.edgeEnd.y) / 2,
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
      ))}
    </group>
  );
}
