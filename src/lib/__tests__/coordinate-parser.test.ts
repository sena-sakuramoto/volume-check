import { parseRequestLatLng } from '../coordinate-parser';

describe('parseRequestLatLng', () => {
  test('accepts numeric lat/lng as-is', () => {
    const result = parseRequestLatLng({ lat: 35.633438, lng: 139.710785 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lat).toBeCloseTo(35.633438, 10);
    expect(result.lng).toBeCloseTo(139.710785, 10);
  });

  test('accepts numeric string lat/lng', () => {
    const result = parseRequestLatLng({ lat: '35.633438', lng: '139.710785' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lat).toBeCloseTo(35.633438, 10);
    expect(result.lng).toBeCloseTo(139.710785, 10);
  });

  test('accepts full-width numeric string lat/lng', () => {
    const result = parseRequestLatLng({ lat: '３５．６３３４３８', lng: '１３９．７１０７８５' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lat).toBeCloseTo(35.633438, 10);
    expect(result.lng).toBeCloseTo(139.710785, 10);
  });

  test('returns 400 for non-numeric lat/lng', () => {
    const result = parseRequestLatLng({ lat: 'abc', lng: 139.7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain('緯度(lat)と経度(lng)は有限の数値');
  });

  test('returns 400 for out-of-range latitude', () => {
    const result = parseRequestLatLng({ lat: 95, lng: 139.7 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain('緯度(lat)は-90〜90');
  });

  test('returns 400 for out-of-range longitude', () => {
    const result = parseRequestLatLng({ lat: 35.6, lng: 181 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain('経度(lng)は-180〜180');
  });
});
