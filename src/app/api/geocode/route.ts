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

function normalizeAddressQuery(address: string): string {
  const compact = address.replace(/\u3000/g, ' ').trim();
  const withoutPostalCode = compact
    .replace(/〒?\s*[0-9０-９]{3}\s*[-ー−‐‑‒–—―ｰ－]?\s*[0-9０-９]{4}(?:\s+|$)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutPostalCode || compact;
}

function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

function normalizeDash(input: string): string {
  return input.replace(/[-ー−‐‑‒–—―ｰ－]/g, '-');
}

function normalizeTownBlockNotation(input: string): string {
  return input
    .replace(/([0-9]+)\s*丁目/gu, '$1-')
    .replace(/([0-9]+)\s*番地?/gu, '$1-')
    .replace(/([0-9]+)\s*号/gu, '$1')
    .replace(/\s*-\s*/g, '-')
    .replace(/-+/g, '-')
    .replace(/-$/g, '');
}

function extractAddressTrunkVariants(input: string): string[] {
  const compact = input.replace(/\s+/g, ' ').trim();
  if (!compact) return [];

  const variants: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const v = value.trim();
    if (v.length === 0 || seen.has(v)) return;
    seen.add(v);
    variants.push(v);
  };

  push(compact);

  const parts = compact.split(' ');
  for (let i = parts.length - 1; i >= 1; i--) {
    push(parts.slice(0, i).join(' '));
  }

  const normalized = normalizeDash(toHalfWidthDigits(compact));
  const addressCore = normalized.match(
    /^(.+?(?:[0-9]+(?:-[0-9]+){1,3}|[0-9]+丁目[0-9]+(?:番地?|番)[0-9]*(?:号)?))/u,
  );
  if (addressCore?.[1]) {
    push(addressCore[1]);
  }

  return variants;
}

function buildQueryCandidates(rawAddress: string): string[] {
  const base = normalizeAddressQuery(rawAddress);
  const rawVariants = extractAddressTrunkVariants(base);
  const normalizedVariants = extractAddressTrunkVariants(normalizeDash(toHalfWidthDigits(base)));

  const variantSources: string[] = [];
  const seenSources = new Set<string>();
  for (const variant of [...rawVariants, ...normalizedVariants]) {
    if (!seenSources.has(variant)) {
      seenSources.add(variant);
      variantSources.push(variant);
    }
  }

  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const query = value.trim();
    if (query.length === 0 || seen.has(query)) return;
    seen.add(query);
    candidates.push(query);
  };

  for (const source of variantSources) {
    const compactSpaces = source.replace(/\s+/g, ' ').trim();
    const noSpaces = compactSpaces.replace(/\s+/g, '');
    const normalized = normalizeDash(toHalfWidthDigits(compactSpaces));
    const normalizedNoSpaces = normalizeDash(toHalfWidthDigits(noSpaces));
    const blockNormalized = normalizeTownBlockNotation(normalized);
    const blockNormalizedNoSpaces = normalizeTownBlockNotation(normalizedNoSpaces);

    push(compactSpaces);
    push(noSpaces);
    push(normalized);
    push(normalizedNoSpaces);
    push(blockNormalized);
    push(blockNormalizedNoSpaces);
  }

  return candidates;
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

    const candidates = buildQueryCandidates(trimmed);
    let features: GSIFeature[] = [];

    for (const query of candidates) {
      const gsiUrl = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let response: Response;
      try {
        response = await fetch(gsiUrl, {
          headers: { 'Accept': 'application/json' },
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return NextResponse.json(
            { error: 'ジオコーディングAPIがタイムアウトしました（10秒）' },
            { status: 504 }
          );
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        console.error(`GSI API responded with status ${response.status}`);
        return NextResponse.json(
          { error: 'ジオコーディングAPIへの接続に失敗しました' },
          { status: 502 }
        );
      }

      const text = await response.text();
      if (!text.trim()) {
        continue;
      }

      let data: GSIFeature[] | null = null;
      try {
        data = JSON.parse(text) as GSIFeature[];
      } catch {
        continue;
      }

      if (Array.isArray(data) && data.length > 0) {
        features = data;
        break;
      }
    }

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

    // Validate coordinate ranges
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      !isFinite(lat) || !isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      console.error(`GSI API returned invalid coordinates: lat=${lat}, lng=${lng}`);
      return NextResponse.json(
        { error: 'ジオコーディング結果の座標が不正です。住所を確認してください。' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      lat,
      lng,
      address: confirmedAddress,
    });
  } catch (error) {
    console.error('Geocode API error:', error);
    const message =
      error instanceof SyntaxError
        ? 'リクエストの形式が不正です'
        : 'サーバー内部エラーが発生しました';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
