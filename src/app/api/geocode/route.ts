import { NextRequest, NextResponse } from 'next/server';

/**
 * Geocode a Japanese address using the 国土地理院 (GSI) geocoding API.
 *
 * POST body: { address: string }
 * Response:  { lat: number, lng: number, address: string }
 *         or { error: string }
 */

interface GSIFeature {
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    title: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: '住所を入力してください' },
        { status: 400 }
      );
    }

    const trimmed = address.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: '住所を入力してください' },
        { status: 400 }
      );
    }

    // Call GSI geocoding API
    const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(trimmed)}`;

    const response = await fetch(gsiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`GSI API responded with status ${response.status}`);
      return NextResponse.json(
        { error: 'ジオコーディングAPIへの接続に失敗しました' },
        { status: 502 }
      );
    }

    const features: GSIFeature[] = await response.json();

    if (!Array.isArray(features) || features.length === 0) {
      return NextResponse.json(
        { error: '住所が見つかりませんでした。より詳細な住所を入力してください。' },
        { status: 404 }
      );
    }

    // Use the first (best) result
    const first = features[0];
    const [lng, lat] = first.geometry.coordinates;
    const confirmedAddress = first.properties.title;

    return NextResponse.json({
      lat,
      lng,
      address: confirmedAddress,
    });
  } catch (error) {
    console.error('Geocode API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
