import { NextRequest, NextResponse } from 'next/server';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import {
  buildSiteFromGeoRing,
  createLocalGeoProjector,
  inferDefaultRoadFromVertices,
  type GeoPoint,
} from '@/lib/site-shape';
import type { Point2D, SiteBoundary } from '@/engine/types';
import {
  featureGeometryToLatLng,
  latLngToPixel,
  latLngToTile,
  pointInFeatureGeometry,
} from '@/lib/mvt-utils';
import { fetchZipEntry } from '@/lib/remote-zip';
import { parseRequestLatLng } from '@/lib/coordinate-parser';

const TOKYO23_LANDUSE_ZIP_URL =
  'https://gic-plateau.s3.ap-northeast-1.amazonaws.com/2020/13100_tokyo23ku_2020_3Dtiles_etc_1_op.zip';
const TOKYO23_LANDUSE_PREFIX =
  '13100_tokyo23ku_2020_3Dtiles_etc_1_op/07_landuse/13100_tokyo23ku_2020_luse';
const TILE_ZOOM = 14;
const NEARBY_PIXEL_THRESHOLD = 768;
const MAX_CANDIDATES = 8;
const SUBDIVISION_MIN_AREA = 400;
const SUBDIVISION_MAX_AREA = 8000;
const SUBDIVISION_MIN_CHILD_AREA = 120;

type MatchMode = 'contains' | 'nearby';
type CandidateKind = 'original' | 'subdivision';

type LanduseCandidate = {
  ring: [number, number][];
  site: SiteBoundary;
  area: number;
  distance: number;
  properties: Record<string, unknown>;
  matchMode: MatchMode;
  candidateKind: CandidateKind;
  splitIndex?: number;
  splitTotal?: number;
  parentArea?: number;
};

function pickOuterRing(rings: [number, number][][]): [number, number][] | null {
  if (!Array.isArray(rings) || rings.length === 0) return null;
  let best: [number, number][] | null = null;
  let bestArea = -1;

  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const area = computeRingArea(ring);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }

  return best;
}

function computeRingArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
  }
  return Math.abs(area) / 2;
}

function computeFeaturePixelDistance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any,
  pixelX: number,
  pixelY: number,
): number {
  const geometry = feature.loadGeometry() as Array<Array<{ x: number; y: number }>>;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const ring of geometry) {
    for (const point of ring) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }

  const dx = Math.max(minX - pixelX, 0, pixelX - maxX);
  const dy = Math.max(minY - pixelY, 0, pixelY - maxY);
  return Math.hypot(dx, dy);
}

function buildOriginalCandidate(
  ring: [number, number][],
  properties: Record<string, unknown>,
  distance: number,
  matchMode: MatchMode,
): LanduseCandidate | null {
  const geoRing = ring.map(([lng, lat]) => ({ lat, lng }));
  const site = buildSiteFromGeoRing(geoRing);
  if (!site) return null;

  return {
    ring,
    site,
    area: site.area,
    distance,
    properties,
    matchMode,
    candidateKind: 'original',
  };
}

function serializeRingKey(ring: [number, number][]): string {
  return ring
    .map(([lng, lat]) => `${lng.toFixed(7)},${lat.toFixed(7)}`)
    .join('|');
}

function normalizePolygon(points: Point2D[]): Point2D[] {
  const normalized: Point2D[] = [];
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const prev = normalized[normalized.length - 1];
    if (prev && Math.abs(prev.x - point.x) < 1e-6 && Math.abs(prev.y - point.y) < 1e-6) continue;
    normalized.push(point);
  }

  while (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
      normalized.pop();
      continue;
    }
    break;
  }

  return normalized;
}

function pointOnSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
  const cross = (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > 1e-6) return false;

  const dot = (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -1e-6) return false;

  const squaredLength = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (dot - squaredLength > 1e-6) return false;

  return true;
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (pointOnSegment(point, polygon[j], polygon[i])) return true;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }
  return inside;
}

function clipPolygon(
  polygon: Point2D[],
  inside: (point: Point2D) => boolean,
  intersect: (start: Point2D, end: Point2D) => Point2D,
): Point2D[] {
  if (polygon.length === 0) return [];
  const output: Point2D[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const previous = polygon[(i + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside) {
      if (!previousInside) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousInside) {
      output.push(intersect(previous, current));
    }
  }

  return normalizePolygon(output);
}

function clipPolygonByAxis(polygon: Point2D[], axis: 'x' | 'y', value: number, keepGreater: boolean): Point2D[] {
  return clipPolygon(
    polygon,
    (point) => (keepGreater ? point[axis] >= value - 1e-6 : point[axis] <= value + 1e-6),
    (start, end) => {
      const delta = end[axis] - start[axis];
      if (Math.abs(delta) < 1e-9) {
        return axis === 'x'
          ? { x: value, y: start.y }
          : { x: start.x, y: value };
      }
      const t = (value - start[axis]) / delta;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    },
  );
}

function clipPolygonToBand(
  polygon: Point2D[],
  axis: 'x' | 'y',
  minValue: number,
  maxValue: number,
): Point2D[] {
  const clippedMin = clipPolygonByAxis(polygon, axis, minValue, true);
  if (clippedMin.length < 3) return [];
  return clipPolygonByAxis(clippedMin, axis, maxValue, false);
}

function getSubdivisionCount(area: number): number {
  if (area > 2400) return 4;
  if (area > 1200) return 3;
  if (area > SUBDIVISION_MIN_AREA) return 2;
  return 0;
}

function expandSubdividedCandidates(candidate: LanduseCandidate, queryPoint: GeoPoint): LanduseCandidate[] {
  if (candidate.area < SUBDIVISION_MIN_AREA || candidate.area > SUBDIVISION_MAX_AREA) return [];

  const geoRing = candidate.ring.map(([lng, lat]) => ({ lat, lng }));
  const projector = createLocalGeoProjector(geoRing);
  if (!projector) return [];

  const localRing = normalizePolygon(projector.toLocalRing(geoRing));
  if (localRing.length < 3) return [];

  const minX = Math.min(...localRing.map((point) => point.x));
  const maxX = Math.max(...localRing.map((point) => point.x));
  const minY = Math.min(...localRing.map((point) => point.y));
  const maxY = Math.max(...localRing.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  const axis: 'x' | 'y' = width >= height ? 'x' : 'y';
  const span = axis === 'x' ? width : height;

  if (!(span > 0)) return [];

  const splitTotal = getSubdivisionCount(candidate.area);
  if (splitTotal <= 1) return [];

  const queryLocal = projector.toLocal(queryPoint);
  const children: LanduseCandidate[] = [];

  for (let i = 0; i < splitTotal; i++) {
    const bandStart = (axis === 'x' ? minX : minY) + (span * i) / splitTotal;
    const bandEnd = (axis === 'x' ? minX : minY) + (span * (i + 1)) / splitTotal;
    const clipped = clipPolygonToBand(localRing, axis, bandStart, bandEnd);
    if (clipped.length < 3) continue;

    const childGeoRing = projector
      .toGeoRing(clipped)
      .map((point) => [point.lng, point.lat] as [number, number]);
    const childGeoPoints = childGeoRing.map(([lng, lat]) => ({ lat, lng }));
    const childSite = buildSiteFromGeoRing(childGeoPoints);
    if (!childSite || childSite.area < SUBDIVISION_MIN_CHILD_AREA) continue;

    children.push({
      ring: childGeoRing,
      site: childSite,
      area: childSite.area,
      distance: pointInPolygon(queryLocal, clipped) ? 0 : candidate.distance,
      properties: candidate.properties,
      matchMode: pointInPolygon(queryLocal, clipped) ? 'contains' : candidate.matchMode,
      candidateKind: 'subdivision',
      splitIndex: i + 1,
      splitTotal,
      parentArea: candidate.area,
    });
  }

  return children;
}

function buildSitePayload(candidate: LanduseCandidate) {
  const road = inferDefaultRoadFromVertices(candidate.site.vertices, 6);
  return {
    site: candidate.site,
    roads: road ? [road] : [],
    siteCoordinates: candidate.ring,
    attributes: candidate.properties,
    matchMode: candidate.matchMode,
    area: Number(candidate.area.toFixed(1)),
    distancePixels: Number(candidate.distance.toFixed(2)),
    candidateKind: candidate.candidateKind,
    splitIndex: candidate.splitIndex ?? null,
    splitTotal: candidate.splitTotal ?? null,
    parentArea: candidate.parentArea ? Number(candidate.parentArea.toFixed(1)) : null,
  };
}

function sortCandidates(a: LanduseCandidate, b: LanduseCandidate): number {
  if (a.matchMode !== b.matchMode) return a.matchMode === 'contains' ? -1 : 1;
  if (a.candidateKind !== b.candidateKind) return a.candidateKind === 'subdivision' ? -1 : 1;
  if (a.matchMode === 'contains') return a.area - b.area;
  return a.distance - b.distance || a.area - b.area;
}

function pickBestCandidate(candidates: LanduseCandidate[]): LanduseCandidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(sortCandidates)[0] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lat: unknown; lng: unknown };
    const parsed = parseRequestLatLng(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { lat, lng } = parsed;
    const queryPoint = { lat, lng };

    const { tileX, tileY } = latLngToTile(lat, lng, TILE_ZOOM);
    const entryPath = `${TOKYO23_LANDUSE_PREFIX}/${TILE_ZOOM}/${tileX}/${tileY}.mvt`;
    const bytes = await fetchZipEntry(TOKYO23_LANDUSE_ZIP_URL, entryPath);
    if (!bytes) {
      return NextResponse.json({ error: 'PLATEAU の土地利用タイルが見つかりませんでした。' }, { status: 404 });
    }

    const tile = new VectorTile(new Pbf(bytes));
    const layers = Object.entries(tile.layers).filter(([, layer]) => layer.length > 0);
    if (layers.length === 0) {
      return NextResponse.json({ error: 'PLATEAU の土地利用タイルは空でした。' }, { status: 404 });
    }

    const extent = layers[0][1].feature(0).extent;
    const { pixelX, pixelY } = latLngToPixel(lat, lng, TILE_ZOOM, tileX, tileY, extent);
    const originalCandidates: LanduseCandidate[] = [];

    for (const [, layer] of layers) {
      for (let i = 0; i < layer.length; i++) {
        const feature = layer.feature(i);
        const rings = featureGeometryToLatLng(feature, TILE_ZOOM, tileX, tileY);
        const ring = pickOuterRing(rings);
        if (!ring) continue;

        const distance = computeFeaturePixelDistance(feature, pixelX, pixelY);
        const matchMode: MatchMode = pointInFeatureGeometry(pixelX, pixelY, feature)
          ? 'contains'
          : distance <= NEARBY_PIXEL_THRESHOLD
            ? 'nearby'
            : 'nearby';
        if (matchMode === 'nearby' && distance > NEARBY_PIXEL_THRESHOLD) continue;

        const candidate = buildOriginalCandidate(
          ring,
          (feature.properties ?? {}) as Record<string, unknown>,
          distance,
          matchMode,
        );
        if (candidate) originalCandidates.push(candidate);
      }
    }

    if (originalCandidates.length === 0) {
      return NextResponse.json({ error: 'PLATEAU の土地利用形状が見つかりませんでした。' }, { status: 404 });
    }

    const subdividedCandidates = originalCandidates.flatMap((candidate) =>
      expandSubdividedCandidates(candidate, queryPoint),
    );

    const mergedCandidates = [...originalCandidates, ...subdividedCandidates]
      .sort(sortCandidates)
      .filter((candidate, index, array) => {
        const key = serializeRingKey(candidate.ring);
        return array.findIndex((item) => serializeRingKey(item.ring) === key) === index;
      })
      .slice(0, MAX_CANDIDATES);

    const selectedCandidate = pickBestCandidate(mergedCandidates);
    if (!selectedCandidate) {
      return NextResponse.json({ error: 'PLATEAU の土地利用形状が見つかりませんでした。' }, { status: 404 });
    }

    const selectedPayload = buildSitePayload(selectedCandidate);
    return NextResponse.json({
      ...selectedPayload,
      source: 'plateau-landuse',
      candidates: mergedCandidates
        .map((candidate, index) => ({
          id: `plateau-${index + 1}`,
          ...buildSitePayload(candidate),
        })),
    });
  } catch (error) {
    console.error('[plateau-landuse-lookup] Error:', error);
    return NextResponse.json(
      { error: 'PLATEAU の土地利用形状の取得に失敗しました。' },
      { status: 500 },
    );
  }
}
