export type ParsedLatLngSuccess = {
  ok: true;
  lat: number;
  lng: number;
};

export type ParsedLatLngFailure = {
  ok: false;
  status: 400;
  error: string;
};

export type ParsedLatLngResult = ParsedLatLngSuccess | ParsedLatLngFailure;

function toHalfWidthNumberChars(input: string): string {
  return input
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[＋﹢]/g, '+')
    .replace(/[－−ー―]/g, '-')
    .replace(/[．。]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/\u3000/g, ' ');
}

function parseCoordinateValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') return null;

  const normalized = toHalfWidthNumberChars(value).trim().replace(/,/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRequestLatLng(payload: { lat: unknown; lng: unknown }): ParsedLatLngResult {
  const lat = parseCoordinateValue(payload.lat);
  const lng = parseCoordinateValue(payload.lng);

  if (lat === null || lng === null) {
    return {
      ok: false,
      status: 400,
      error: '緯度(lat)と経度(lng)は有限の数値で指定してください',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      ok: false,
      status: 400,
      error: `緯度(lat)は-90〜90の範囲で指定してください（受信値: ${lat}）`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      ok: false,
      status: 400,
      error: `経度(lng)は-180〜180の範囲で指定してください（受信値: ${lng}）`,
    };
  }

  return { ok: true, lat, lng };
}
