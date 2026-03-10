import { NextRequest, NextResponse } from 'next/server';
import { parseRequestLatLng } from '@/lib/coordinate-parser';
import { buildSiteFromGeoRing } from '@/lib/site-shape';
import {
  inferRoadEdgesFromGeometry,
  inferRoadEdgesFromLines,
  type LocalRoadLine,
} from '@/lib/road-inference';

type OverpassElement = {
  type?: string;
  tags?: Record<string, string>;
  geometry?: Array<{ lat?: number; lon?: number }>;
};

type RoadLookupPayload = {
  roads: Array<{
    edgeVertexIndices: [number, number];
    width: number;
    direction: 'north' | 'south' | 'east' | 'west';
    distance: number | null;
    name?: string;
    highway?: string;
    confidence: 'high' | 'medium' | 'low';
    sourceLabel: string;
    sourceDetail?: string;
    reasoning: string;
  }>;
  source: 'osm-overpass' | 'geometry-heuristic';
  radiusMeters: number;
  roadLineCount: number;
  message?: string;
  cached?: boolean;
};

const FALLBACK_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const REQUEST_TIMEOUT_MS = 4_500;
const OVERPASS_CACHE_TTL_MS = 3 * 60 * 1000;
const RESPONSE_CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_OVERPASS_WAIT_MS = 5_000;

const globalCaches = globalThis as typeof globalThis & {
  __volumeCheckRoadLookupCaches?: {
    overpass: Map<string, { expiresAt: number; elements: OverpassElement[] }>;
    response: Map<string, { expiresAt: number; payload: RoadLookupPayload }>;
  };
};

if (!globalCaches.__volumeCheckRoadLookupCaches) {
  globalCaches.__volumeCheckRoadLookupCaches = {
    overpass: new Map<string, { expiresAt: number; elements: OverpassElement[] }>(),
    response: new Map<string, { expiresAt: number; payload: RoadLookupPayload }>(),
  };
}

const overpassCache = globalCaches.__volumeCheckRoadLookupCaches.overpass;
const responseCache = globalCaches.__volumeCheckRoadLookupCaches.response;

function parseSiteCoordinates(value: unknown): Array<{ lat: number; lng: number }> | null {
  if (!Array.isArray(value) || value.length < 3) return null;

  const points: Array<{ lat: number; lng: number }> = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return null;
    const [lng, lat] = item;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    points.push({ lat, lng });
  }

  const first = points[0];
  const last = points[points.length - 1];
  const isClosed =
    Math.abs(first.lat - last.lat) < 1e-12 &&
    Math.abs(first.lng - last.lng) < 1e-12;
  if (isClosed) points.pop();

  return points.length >= 3 ? points : null;
}

function createProjector(ring: Array<{ lat: number; lng: number }>): {
  project: (lat: number, lng: number) => { x: number; y: number };
} {
  const meanLat = ring.reduce((sum, point) => sum + point.lat, 0) / ring.length;
  const meanLng = ring.reduce((sum, point) => sum + point.lng, 0) / ring.length;
  const phi = (meanLat * Math.PI) / 180;

  const metersPerDegLat =
    111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
  const metersPerDegLng =
    111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);

  const rawSite = ring.map((point) => ({
    x: (point.lng - meanLng) * metersPerDegLng,
    y: (point.lat - meanLat) * metersPerDegLat,
  }));
  const minX = Math.min(...rawSite.map((point) => point.x));
  const minY = Math.min(...rawSite.map((point) => point.y));

  return {
    project: (lat: number, lng: number) => ({
      x: (lng - meanLng) * metersPerDegLng - minX,
      y: (lat - meanLat) * metersPerDegLat - minY,
    }),
  };
}

function estimateRoadWidth(tags: Record<string, string> | undefined): number {
  if (!tags) return 6;

  const rawWidth = tags.width ?? tags['est_width'];
  if (rawWidth) {
    const matched = rawWidth.match(/(\d+(?:\.\d+)?)/);
    if (matched) {
      const width = Number.parseFloat(matched[1]);
      if (Number.isFinite(width) && width > 0) return Math.max(2, Math.min(width, 40));
    }
  }

  const rawLanes = tags.lanes;
  if (rawLanes) {
    const lanes = Number.parseInt(rawLanes, 10);
    if (Number.isFinite(lanes) && lanes > 0) {
      return Math.max(3, Math.min(lanes * 3, 30));
    }
  }

  const byHighway: Record<string, number> = {
    motorway: 24,
    trunk: 16,
    primary: 12,
    secondary: 9,
    tertiary: 8,
    residential: 6,
    unclassified: 6,
    service: 4,
    living_street: 4,
    pedestrian: 4,
    footway: 3,
    path: 2.5,
  };
  const highway = tags.highway ?? '';
  return byHighway[highway] ?? 6;
}

function estimateSearchRadius(siteVertices: { x: number; y: number }[]): number {
  const minX = Math.min(...siteVertices.map((v) => v.x));
  const maxX = Math.max(...siteVertices.map((v) => v.x));
  const minY = Math.min(...siteVertices.map((v) => v.y));
  const maxY = Math.max(...siteVertices.map((v) => v.y));
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  return Math.max(40, Math.min(180, Math.round(diagonal * 1.8 + 30)));
}

function formatHighwayTag(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, ' ');
}

function describeRoadSource(name?: string, highway?: string): string | undefined {
  const parts = [
    name ? `道路名: ${name}` : null,
    highway ? `OSM種別: ${formatHighwayTag(highway)}` : null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' / ') : undefined;
}

function estimateInferenceConfidence(distance: number | null, hasNamedRoad: boolean): 'high' | 'medium' | 'low' {
  if (distance !== null && distance <= 2 && hasNamedRoad) return 'high';
  if (distance !== null && distance <= 5) return 'medium';
  return 'low';
}

function buildOsmReasoning(args: {
  distance: number | null;
  direction: 'north' | 'south' | 'east' | 'west';
  name?: string;
  highway?: string;
}): string {
  const parts = [
    args.distance !== null ? `敷地辺との距離 ${args.distance.toFixed(2)}m` : null,
    `方位推定 ${args.direction}`,
    args.name ? `道路名 ${args.name}` : null,
    args.highway ? `highway=${args.highway}` : null,
  ].filter((value): value is string => Boolean(value));
  return parts.join(' / ');
}

function buildGeometryReasoning(edgeStart: { x: number; y: number }, edgeEnd: { x: number; y: number }, direction: 'north' | 'south' | 'east' | 'west'): string {
  const length = Math.hypot(edgeEnd.x - edgeStart.x, edgeEnd.y - edgeStart.y);
  return `周辺道路データ不足のため敷地形状から推定 / ${direction}側 / 辺長 ${length.toFixed(2)}m`;
}

async function fetchOverpassWays(
  lat: number,
  lng: number,
  radius: number,
): Promise<OverpassElement[]> {
  const cacheKey = `${lat.toFixed(5)}:${lng.toFixed(5)}:${radius}`;
  const cached = overpassCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.elements;
  }

  const body = `[out:json][timeout:12];way(around:${radius},${lat},${lng})["highway"];out tags geom;`;
  const configured = process.env.OVERPASS_API_URL;
  const endpoints = [
    configured,
    ...FALLBACK_OVERPASS_ENDPOINTS,
  ].filter((value, index, list): value is string => typeof value === 'string' && list.indexOf(value) === index);

  const fetchTasks = endpoints.map(async (endpoint) => {
    const controller = new AbortController();
    const timeoutPromise = new Promise<OverpassElement[]>((resolve) => {
      setTimeout(() => {
        controller.abort();
        resolve([]);
      }, REQUEST_TIMEOUT_MS);
    });

    const fetchPromise = (async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/plain; charset=utf-8',
          },
          body,
          signal: controller.signal,
        });
        if (!response.ok) return [] as OverpassElement[];

        const text = await response.text();
        if (!text.trim()) return [] as OverpassElement[];

        let payload: { elements?: OverpassElement[] } | null = null;
        try {
          payload = JSON.parse(text) as { elements?: OverpassElement[] };
        } catch {
          payload = null;
        }
        return Array.isArray(payload?.elements) ? payload.elements : [];
      } catch {
        return [] as OverpassElement[];
      }
    })();

    try {
      return await Promise.race([fetchPromise, timeoutPromise]);
    } catch {
      return [] as OverpassElement[];
    }
  });

  if (fetchTasks.length === 0) {
    return [];
  }

  const settled = await Promise.all(fetchTasks);
  const best = settled.sort((a, b) => b.length - a.length)[0] ?? [];
  if (best.length > 0) {
    overpassCache.set(cacheKey, {
      expiresAt: Date.now() + OVERPASS_CACHE_TTL_MS,
      elements: best,
    });
  }
  return best;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = parseRequestLatLng({ lat: body?.lat, lng: body?.lng });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const siteRing = parseSiteCoordinates(body?.siteCoordinates);
    if (!siteRing) {
      return NextResponse.json(
        { error: 'siteCoordinates は [lng, lat] の配列で3点以上必要です' },
        { status: 400 },
      );
    }

    const site = buildSiteFromGeoRing(siteRing);
    if (!site) {
      return NextResponse.json(
        { error: '敷地ポリゴンの変換に失敗しました' },
        { status: 422 },
      );
    }

    const responseKey = [
      parsed.lat.toFixed(6),
      parsed.lng.toFixed(6),
      siteRing.map((point) => `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`).join('|'),
    ].join(':');
    const cachedResponse = responseCache.get(responseKey);
    if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
      return NextResponse.json({ ...cachedResponse.payload, cached: true });
    }

    const centerLat = siteRing.reduce((sum, point) => sum + point.lat, 0) / siteRing.length;
    const centerLng = siteRing.reduce((sum, point) => sum + point.lng, 0) / siteRing.length;
    const radius = estimateSearchRadius(site.vertices);
    let overpassTimedOut = false;
    const elements = await Promise.race([
      fetchOverpassWays(centerLat, centerLng, radius),
      new Promise<OverpassElement[]>((resolve) => {
        setTimeout(() => {
          overpassTimedOut = true;
          resolve([]);
        }, MAX_OVERPASS_WAIT_MS);
      }),
    ]);

    const { project } = createProjector(siteRing);
    const roadLines: LocalRoadLine[] = [];

    for (const element of elements) {
      if (element.type !== 'way' || !Array.isArray(element.geometry) || element.geometry.length < 2) {
        continue;
      }
      const points = element.geometry
        .map((point) => {
          if (typeof point.lat !== 'number' || typeof point.lon !== 'number') return null;
          return project(point.lat, point.lon);
        })
        .filter((point): point is { x: number; y: number } => Boolean(point));

      if (points.length < 2) continue;
      roadLines.push({
        points,
        width: estimateRoadWidth(element.tags),
        name: element.tags?.name,
        highway: element.tags?.highway,
      });
    }

    const inferred = roadLines.length > 0
      ? inferRoadEdgesFromLines(site.vertices, roadLines, {
          maxDistance: 14,
          minParallel: 0.6,
          maxEdges: Math.min(6, site.vertices.length),
        })
      : [];

    const roadCandidates = inferred.length > 0
      ? inferred
      : inferRoadEdgesFromGeometry(site.vertices, Math.min(2, site.vertices.length));

    const roads = roadCandidates.map((road) => {
      const distance = Number.isFinite(road.distance) ? Number(road.distance.toFixed(2)) : null;
      const sourceDetail = describeRoadSource(road.name, road.highway);

      if (inferred.length > 0) {
        return {
          edgeVertexIndices: road.edgeVertexIndices,
          width: Number(road.width.toFixed(2)),
          direction: road.direction,
          distance,
          name: road.name,
          highway: road.highway,
          confidence: estimateInferenceConfidence(distance, Boolean(road.name || road.highway)),
          sourceLabel: 'OpenStreetMap / Overpass API',
          sourceDetail,
          reasoning: buildOsmReasoning({
            distance,
            direction: road.direction,
            name: road.name,
            highway: road.highway,
          }),
        };
      }

      const [startIndex, endIndex] = road.edgeVertexIndices;
      return {
        edgeVertexIndices: road.edgeVertexIndices,
        width: Number(road.width.toFixed(2)),
        direction: road.direction,
        distance,
        name: road.name,
        highway: road.highway,
        confidence: 'low' as const,
        sourceLabel: '敷地形状ヒューリスティック',
        sourceDetail: '周辺道路データなし',
        reasoning: buildGeometryReasoning(site.vertices[startIndex], site.vertices[endIndex], road.direction),
      };
    });

    const payload: RoadLookupPayload = {
      roads,
      source: inferred.length > 0 ? 'osm-overpass' : 'geometry-heuristic',
      radiusMeters: radius,
      roadLineCount: roadLines.length,
      ...(inferred.length > 0
        ? {}
        : {
            message: overpassTimedOut
              ? '道路データ取得がタイムアウトしたため、敷地形状から接道を推定しました'
              : '周辺道路データが不足しているため、敷地形状から接道を推定しました',
          }),
    };
    if (!overpassTimedOut) {
      responseCache.set(responseKey, {
        expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
        payload,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[road-lookup] Error:', error);
    return NextResponse.json(
      { error: '道路判定の取得中にサーバーエラーが発生しました' },
      { status: 500 },
    );
  }
}
