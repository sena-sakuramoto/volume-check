import type { Point2D, Road, SiteBoundary } from '@/engine/types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function normalizeGeoRing(points: GeoPoint[]): GeoPoint[] {
  const valid = points.filter((p) => isFiniteNumber(p.lat) && isFiniteNumber(p.lng));
  if (valid.length < 3) return [];

  const first = valid[0];
  const last = valid[valid.length - 1];
  const isClosed = Math.abs(first.lat - last.lat) < 1e-12 && Math.abs(first.lng - last.lng) < 1e-12;
  const normalized = isClosed ? valid.slice(0, -1) : valid;
  return normalized.length >= 3 ? normalized : [];
}

function coordinatesToRing(coords: unknown): GeoPoint[] | null {
  if (!Array.isArray(coords)) return null;
  const ring: GeoPoint[] = [];
  for (const item of coords) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const [lng, lat] = item;
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return null;
    ring.push({ lat, lng });
  }
  const normalized = normalizeGeoRing(ring);
  return normalized.length >= 3 ? normalized : null;
}

function extractFromGeometry(geometry: unknown): GeoPoint[] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: unknown; coordinates?: unknown };
  if (typeof g.type !== 'string') return null;

  if (g.type === 'Polygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
    return coordinatesToRing(g.coordinates[0]);
  }

  if (g.type === 'MultiPolygon') {
    if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
    let best: GeoPoint[] | null = null;
    let bestSize = -1;
    for (const poly of g.coordinates) {
      if (!Array.isArray(poly) || poly.length === 0) continue;
      const ring = coordinatesToRing(poly[0]);
      if (ring && ring.length > bestSize) {
        best = ring;
        bestSize = ring.length;
      }
    }
    return best;
  }

  return null;
}

export function extractGeoRingFromPayload(payload: unknown): GeoPoint[] | null {
  if (!payload || typeof payload !== 'object') return null;

  const obj = payload as {
    type?: unknown;
    features?: unknown;
    geometry?: unknown;
    coordinates?: unknown;
  };

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (const feature of obj.features) {
      if (!feature || typeof feature !== 'object') continue;
      const ring = extractFromGeometry((feature as { geometry?: unknown }).geometry);
      if (ring) return ring;
    }
    return null;
  }

  if (obj.type === 'Feature') {
    return extractFromGeometry(obj.geometry);
  }

  const direct = extractFromGeometry(payload);
  if (direct) return direct;

  if (Array.isArray(obj.coordinates)) {
    if (obj.coordinates.length > 0 && Array.isArray(obj.coordinates[0]) && Array.isArray(obj.coordinates[0][0])) {
      return coordinatesToRing(obj.coordinates[0]);
    }
  }

  return null;
}

function toLocalVertices(ring: GeoPoint[]): Point2D[] {
  const meanLat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const meanLng = ring.reduce((s, p) => s + p.lng, 0) / ring.length;
  const phi = (meanLat * Math.PI) / 180;
  const metersPerDegLat =
    111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
  const metersPerDegLng =
    111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);

  const raw = ring.map((p) => ({
    x: (p.lng - meanLng) * metersPerDegLng,
    y: (p.lat - meanLat) * metersPerDegLat,
  }));

  const minX = Math.min(...raw.map((v) => v.x));
  const minY = Math.min(...raw.map((v) => v.y));
  return raw.map((v) => ({ x: v.x - minX, y: v.y - minY }));
}

function polygonArea(vertices: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

function normalizeClockwise(vertices: Point2D[]): Point2D[] {
  let signed = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    signed += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
  }
  return signed > 0 ? [...vertices].reverse() : vertices;
}

export function buildSiteFromGeoRing(ring: GeoPoint[]): SiteBoundary | null {
  const normalizedRing = normalizeGeoRing(ring);
  if (normalizedRing.length < 3) return null;
  const local = normalizeClockwise(toLocalVertices(normalizedRing));
  const area = polygonArea(local);
  if (!Number.isFinite(area) || area <= 0) return null;
  return { vertices: local, area };
}

export function inferDefaultRoadFromVertices(vertices: Point2D[], width: number = 6): Road | null {
  if (!Array.isArray(vertices) || vertices.length < 2) return null;

  let bestIdx = 0;
  let bestLenSq = -1;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dx = vertices[j].x - vertices[i].x;
    const dy = vertices[j].y - vertices[i].y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq > bestLenSq) {
      bestLenSq = lenSq;
      bestIdx = i;
    }
  }

  const start = vertices[bestIdx];
  const end = vertices[(bestIdx + 1) % vertices.length];
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // CW polygon outward normal
  const nx = dy;
  const ny = -dx;
  const bearing = ((Math.atan2(nx, ny) * 180) / Math.PI + 360) % 360;

  return {
    edgeStart: start,
    edgeEnd: end,
    width,
    centerOffset: width / 2,
    bearing,
  };
}

