import { describe, it, expect } from '@jest/globals';
import { encodeShareLink, decodeShareLink } from '../share-link';
import type { ShareablePayload } from '../share-link';

const sample: ShareablePayload = {
  v: 1,
  name: 'テスト案件',
  address: '東京都新宿区西新宿3丁目',
  lat: 35.68,
  lng: 139.76,
  site: {
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 15 },
      { x: 0, y: 15 },
    ],
    area: 150,
  },
  roads: [],
  zoning: {
    district: '商業地域',
    fireDistrict: '防火地域',
    heightDistrict: { type: '指定なし' },
    coverageRatio: 0.8,
    floorAreaRatio: 6,
    absoluteHeightLimit: null,
    wallSetback: null,
    shadowRegulation: null,
    isCornerLot: false,
    districtPlan: null,
  },
  latitude: 35.68,
  floorHeights: [4.2, 3.6, 3.6],
  skyMaxScale: 1.23,
};

describe('share-link', () => {
  it('roundtrips a payload', () => {
    const encoded = encodeShareLink(sample);
    const decoded = decodeShareLink(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe(sample.name);
    expect(decoded!.lat).toBe(sample.lat);
    expect(decoded!.site.area).toBe(sample.site.area);
    expect(decoded!.skyMaxScale).toBe(sample.skyMaxScale);
  });

  it('survives Japanese characters in the name', () => {
    const payload = { ...sample, name: '新宿区西新宿3丁目計画（仮称）' };
    const encoded = encodeShareLink(payload);
    const decoded = decodeShareLink(encoded);
    expect(decoded!.name).toBe(payload.name);
  });

  it('returns null for invalid input', () => {
    expect(decodeShareLink('!!not base64!!')).toBeNull();
    expect(decodeShareLink('')).toBeNull();
  });

  it('rejects payloads with wrong version', () => {
    const bad = { ...sample, v: 2 as unknown as 1 };
    const encoded = encodeShareLink(bad);
    expect(decodeShareLink(encoded)).toBeNull();
  });
});
