import { NextRequest, NextResponse } from 'next/server';
import { buildSiteFromGeoRing, extractGeoRingFromPayload, inferDefaultRoadFromVertices } from '@/lib/site-shape';
import { parseRequestLatLng } from '@/lib/coordinate-parser';

interface ParcelLookupRequest {
  lat: number;
  lng: number;
  address?: string;
}

const REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_ROAD_WIDTH = 6;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ParcelLookupRequest>;
    const { address } = body;
    const parsed = parseRequestLatLng({ lat: body.lat, lng: body.lng });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const { lat, lng } = parsed;

    const endpoint = process.env.PARCEL_SHAPE_API_URL;
    if (!endpoint) {
      return NextResponse.json(
        { error: '敷地形状APIが未設定です（PARCEL_SHAPE_API_URL）' },
        { status: 503 },
      );
    }

    const apiKey = process.env.PARCEL_SHAPE_API_KEY;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({ lat, lng, address }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `敷地形状APIの応答エラー: ${response.status}` },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const ring = extractGeoRingFromPayload(payload);
    if (!ring) {
      return NextResponse.json(
        { error: '敷地形状データを取得できませんでした' },
        { status: 404 },
      );
    }

    const site = buildSiteFromGeoRing(ring);
    if (!site) {
      return NextResponse.json(
        { error: '敷地形状データの変換に失敗しました' },
        { status: 422 },
      );
    }

    const road = inferDefaultRoadFromVertices(site.vertices, DEFAULT_ROAD_WIDTH);

    return NextResponse.json({
      site,
      roads: road ? [road] : [],
      siteCoordinates: ring.map((point) => [point.lng, point.lat] as [number, number]),
      source: 'parcel-shape-api',
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    return NextResponse.json(
      { error: isAbort ? '敷地形状APIがタイムアウトしました' : '敷地形状取得中にサーバーエラーが発生しました' },
      { status: isAbort ? 504 : 500 },
    );
  }
}
