/**
 * Client-side parsers for site boundary data files (CSV / GeoJSON / SIMA).
 * No server call needed — parsed directly in the browser.
 */

import type { SiteBoundary, Road, Point2D } from '@/engine/types';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface SiteFileParseResult {
  site: SiteBoundary;
  roads: Road[];
  /** Latitude for shadow calculation (only from GeoJSON) */
  latitude?: number;
  /** Human-readable notes */
  notes: string;
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

/**
 * Parse CSV coordinate file.
 *
 * Expected format (header optional):
 *   point_no,x,y
 *   1,0.000,0.000
 *   2,12.500,0.000
 *   ...
 *
 * Also accepts:
 *   x,y (two-column, no point_no)
 *   0.000,0.000
 *   12.500,0.000
 *
 * Coordinates are in meters (local coordinate system).
 */
export function parseCSV(text: string): SiteFileParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('CSVファイルが空です');
  }

  // Detect header row
  let startIdx = 0;
  const firstLine = lines[0].toLowerCase();
  if (
    firstLine.includes('point') ||
    firstLine.includes('no') ||
    firstLine.includes('x') ||
    firstLine.includes('y') ||
    /^[a-z]/.test(firstLine)
  ) {
    startIdx = 1;
  }

  const vertices: Point2D[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s) => s.trim());

    let x: number, y: number;

    if (parts.length >= 3) {
      // point_no, x, y
      x = parseFloat(parts[1]);
      y = parseFloat(parts[2]);
    } else if (parts.length === 2) {
      // x, y
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
    } else {
      continue; // Skip malformed lines
    }

    if (isNaN(x) || isNaN(y)) continue;
    vertices.push({ x, y });
  }

  if (vertices.length < 3) {
    throw new Error('3点以上の頂点が必要です（' + vertices.length + '点しかありません）');
  }

  const area = calcPolygonArea(vertices);
  if (area <= 0) {
    throw new Error('有効な多角形になりません（面積が0以下）');
  }

  return {
    site: { vertices, area },
    roads: [],
    notes: `CSV座標から${vertices.length}頂点の敷地を読み込みました（${area.toFixed(1)}m²）`,
  };
}

// ---------------------------------------------------------------------------
// GeoJSON parser
// ---------------------------------------------------------------------------

/**
 * Parse GeoJSON file containing a site boundary polygon.
 *
 * Accepts:
 * - Feature with Polygon geometry
 * - FeatureCollection (uses first Polygon feature)
 * - Bare Polygon geometry
 *
 * Coordinates are [lng, lat] in WGS84, converted to local meters.
 */
export function parseGeoJSON(text: string): SiteFileParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('GeoJSONのパースに失敗しました（無効なJSON）');
  }

  const obj = json as Record<string, unknown>;
  let coords: number[][] | null = null;
  let properties: Record<string, unknown> = {};

  if (obj.type === 'FeatureCollection') {
    const features = obj.features as Record<string, unknown>[];
    if (!Array.isArray(features) || features.length === 0) {
      throw new Error('FeatureCollectionにFeatureがありません');
    }
    // Find first Polygon feature
    const polyFeature = features.find(
      (f) => (f.geometry as Record<string, unknown>)?.type === 'Polygon',
    );
    if (!polyFeature) {
      throw new Error('Polygonタイプのジオメトリが見つかりません');
    }
    const geom = polyFeature.geometry as Record<string, unknown>;
    coords = (geom.coordinates as number[][][])?.[0] ?? null;
    properties = (polyFeature.properties as Record<string, unknown>) ?? {};
  } else if (obj.type === 'Feature') {
    const geom = obj.geometry as Record<string, unknown>;
    if (geom?.type !== 'Polygon') {
      throw new Error('Polygonタイプのジオメトリが必要です（' + geom?.type + '）');
    }
    coords = (geom.coordinates as number[][][])?.[0] ?? null;
    properties = (obj.properties as Record<string, unknown>) ?? {};
  } else if (obj.type === 'Polygon') {
    coords = (obj.coordinates as number[][][])?.[0] ?? null;
  } else {
    throw new Error('対応するGeoJSONタイプ: Feature, FeatureCollection, Polygon');
  }

  if (!coords || coords.length < 3) {
    throw new Error('3点以上の座標が必要です');
  }

  // Remove closing point if it duplicates the first
  if (
    coords.length > 3 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
  ) {
    coords = coords.slice(0, -1);
  }

  if (coords.length < 3) {
    throw new Error('3点以上の頂点が必要です');
  }

  // Detect if coordinates are lat/lng or already in meters
  const isLatLng = coords.every(
    (c) => Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90,
  );

  let vertices: Point2D[];
  let latitude: number | undefined;

  if (isLatLng) {
    // Convert [lng, lat] to local meters
    const centroid = computeCentroid(coords);
    latitude = centroid.lat;

    const metersPerDegreeLat = 110940;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos((centroid.lat * Math.PI) / 180);

    vertices = coords.map((c) => ({
      x: (c[0] - centroid.lng) * metersPerDegreeLng,
      y: (c[1] - centroid.lat) * metersPerDegreeLat,
    }));
  } else {
    // Assume already in meters (平面直角座標系)
    vertices = coords.map((c) => ({ x: c[0], y: c[1] }));
  }

  const providedArea =
    typeof properties.area === 'number' ? properties.area : undefined;
  const area = providedArea ?? calcPolygonArea(vertices);

  if (area <= 0) {
    throw new Error('有効な多角形になりません（面積が0以下）');
  }

  // Extract roads from properties if present
  const roads: Road[] = [];
  if (Array.isArray(properties.roads)) {
    for (const rd of properties.roads as Record<string, unknown>[]) {
      const width = typeof rd.width === 'number' ? rd.width : 6;
      const edgeIdx = Array.isArray(rd.edgeVertexIndices)
        ? (rd.edgeVertexIndices as number[])
        : [0, 1];
      const startIdx = edgeIdx[0] ?? 0;
      const endIdx = edgeIdx[1] ?? 1;
      const edgeStart = vertices[startIdx] ?? vertices[0];
      const edgeEnd = vertices[endIdx] ?? vertices[1];

      const dx = edgeEnd.x - edgeStart.x;
      const dy = edgeEnd.y - edgeStart.y;
      const bearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
      const outward = (bearing + 90) % 360;

      roads.push({
        edgeStart,
        edgeEnd,
        width,
        centerOffset: width / 2,
        bearing: outward,
      });
    }
  }

  const coordType = isLatLng ? 'WGS84座標' : '平面直角座標';
  return {
    site: { vertices, area },
    roads,
    latitude,
    notes: `GeoJSONから${vertices.length}頂点の敷地を読み込みました（${coordType}、${area.toFixed(1)}m²）`,
  };
}

// ---------------------------------------------------------------------------
// SIMA parser
// ---------------------------------------------------------------------------

/**
 * Parse SIMA survey data file (.sim).
 *
 * SIMA (Survey Information Manager Application) is a Japanese standard format.
 * Key record types:
 *   01,SIMA(VER03)  — header
 *   A,name,X,Y[,Z]  — survey point (A record)
 *   99,END           — end marker
 *
 * In Japanese surveying: X = north, Y = east.
 * We convert to: our_x = sima_Y (east), our_y = sima_X (north).
 */
export function parseSIMA(text: string): SiteFileParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('SIMAファイルが空です');
  }

  // Verify it looks like SIMA
  const header = lines[0].toUpperCase();
  if (!header.includes('SIMA')) {
    throw new Error('SIMA形式のヘッダーが見つかりません（01,SIMA...）');
  }

  const vertices: Point2D[] = [];
  const pointNames: string[] = [];

  for (const line of lines) {
    const parts = line.split(',').map((s) => s.trim());
    if (parts.length < 4) continue;

    // A record: A,point_name,X(north),Y(east)[,Z]
    if (parts[0].toUpperCase() === 'A') {
      const simaX = parseFloat(parts[2]); // north
      const simaY = parseFloat(parts[3]); // east

      if (isNaN(simaX) || isNaN(simaY)) continue;

      // Convert: our x = east (sima Y), our y = north (sima X)
      vertices.push({ x: simaY, y: simaX });
      pointNames.push(parts[1]);
    }
  }

  if (vertices.length < 3) {
    throw new Error('3点以上の測量点が必要です（' + vertices.length + '点しかありません）');
  }

  // Center the coordinates (SIMA uses absolute plane rectangular coords)
  const cx = vertices.reduce((s, v) => s + v.x, 0) / vertices.length;
  const cy = vertices.reduce((s, v) => s + v.y, 0) / vertices.length;
  const centered = vertices.map((v) => ({ x: v.x - cx, y: v.y - cy }));

  const area = calcPolygonArea(centered);
  if (area <= 0) {
    throw new Error('有効な多角形になりません（面積が0以下）');
  }

  return {
    site: { vertices: centered, area },
    roads: [],
    notes: `SIMA測量データから${centered.length}頂点の敷地を読み込みました（${area.toFixed(1)}m²）`,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher: detect format and parse
// ---------------------------------------------------------------------------

export function parseSiteFile(
  fileName: string,
  content: string,
): SiteFileParseResult {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';

  if (ext === 'csv') {
    return parseCSV(content);
  }
  if (ext === 'geojson' || ext === 'json') {
    return parseGeoJSON(content);
  }
  if (ext === 'sim') {
    return parseSIMA(content);
  }

  // Try to auto-detect
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseGeoJSON(content);
  }
  // Check for SIMA header
  if (trimmed.toUpperCase().startsWith('01,SIMA')) {
    return parseSIMA(content);
  }
  return parseCSV(content);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcPolygonArea(verts: Point2D[]): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
  }
  return Math.abs(area) / 2;
}

function computeCentroid(coords: number[][]): { lat: number; lng: number } {
  let lat = 0;
  let lng = 0;
  for (const c of coords) {
    lng += c[0];
    lat += c[1];
  }
  return { lat: lat / coords.length, lng: lng / coords.length };
}
