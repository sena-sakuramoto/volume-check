import { NextRequest, NextResponse } from 'next/server';

/**
 * Fetch nearby buildings from OpenStreetMap via Overpass API,
 * returning building footprints (as [lng, lat] rings) with heights.
 *
 * This is a pragmatic substitute until PLATEAU 3D Tiles integration lands —
 * OSM has excellent coverage in urban Japan and no API key.
 *
 * POST body: { lat: number, lng: number, radiusMeters?: number }
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const TIMEOUT_MS = 5000;

interface OverpassWay {
  type: 'way';
  tags?: Record<string, string>;
  geometry?: Array<{ lat?: number; lon?: number }>;
}

interface NearbyBuilding {
  ring: Array<[number, number]>; // [lng, lat]
  /** estimated height in meters */
  height: number;
}

function estimateHeight(tags?: Record<string, string>): number {
  if (!tags) return 6;
  const h = tags['height'] ?? tags['building:height'];
  if (h) {
    const m = h.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const v = Number.parseFloat(m[1]);
      if (Number.isFinite(v) && v > 0) return Math.min(v, 200);
    }
  }
  const lv = tags['building:levels'] ?? tags['levels'];
  if (lv) {
    const v = Number.parseInt(lv, 10);
    if (Number.isFinite(v) && v > 0) return Math.min(v, 60) * 3.2;
  }
  // Default 2-floor residential if tagged building but no height info
  return 6.5;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const radius = Math.max(50, Math.min(Number(body?.radiusMeters) || 200, 500));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
    }

    const query = `[out:json][timeout:8];
(
  way["building"](around:${radius},${lat},${lng});
);
out geom tags;`;

    let data: { elements?: OverpassWay[] } | null = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        clearTimeout(to);
        if (!resp.ok) continue;
        data = (await resp.json()) as { elements?: OverpassWay[] };
        break;
      } catch {
        // try next endpoint
      }
    }

    if (!data) {
      return NextResponse.json(
        { buildings: [], error: 'Overpass API に到達できませんでした' },
        { status: 200 },
      );
    }

    const buildings: NearbyBuilding[] = [];
    for (const el of data.elements ?? []) {
      if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 3) continue;
      const ring: Array<[number, number]> = [];
      for (const p of el.geometry) {
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') continue;
        ring.push([p.lon, p.lat]);
      }
      if (ring.length < 3) continue;
      buildings.push({ ring, height: estimateHeight(el.tags) });
    }

    return NextResponse.json({
      buildings,
      center: { lat, lng },
      radius,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error';
    return NextResponse.json({ error: msg, buildings: [] }, { status: 500 });
  }
}
