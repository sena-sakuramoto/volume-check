import { describe, it, expect } from '@jest/globals';
import * as THREE from 'three';
import { geodeticToEcef, ecefToLocalEnuMatrix } from '../ecef';

describe('ECEF helpers', () => {
  it('converts a known point (0°, 0°) to the +X WGS84 semi-major', () => {
    const p = geodeticToEcef(0, 0);
    expect(p.x).toBeCloseTo(6378137.0, 0);
    expect(p.y).toBeCloseTo(0, 0);
    expect(p.z).toBeCloseTo(0, 0);
  });

  it('converts Tokyo roughly (35.68°, 139.76°)', () => {
    const p = geodeticToEcef(35.68, 139.76);
    // Actual values computed by WGS84 ellipsoid at 35.68N 139.76E, alt=0.
    expect(p.x).toBeCloseTo(-3959310, -3);
    expect(p.y).toBeCloseTo(3350617, -3);
    expect(p.z).toBeCloseTo(3699408, -3);
  });

  it('local ENU matrix maps the origin ECEF point to origin', () => {
    const lat = 35.68;
    const lng = 139.76;
    const m = ecefToLocalEnuMatrix(lat, lng);
    const origin = geodeticToEcef(lat, lng);
    const v = new THREE.Vector3(origin.x, origin.y, origin.z).applyMatrix4(m);
    expect(v.length()).toBeLessThan(1e-3);
  });

  it('a 1m eastward offset in ECEF becomes a ~1m +X shift in ENU', () => {
    const lat = 35.68;
    const lng = 139.76;
    const m = ecefToLocalEnuMatrix(lat, lng);
    const origin = geodeticToEcef(lat, lng);

    // Offset geodetic lng by a tiny amount so the ECEF displacement is ~1m east.
    const east = geodeticToEcef(lat, lng + 1e-5);
    const dx = east.x - origin.x;
    const dy = east.y - origin.y;
    const dz = east.z - origin.z;
    const localOffset = new THREE.Vector3(
      origin.x + dx,
      origin.y + dy,
      origin.z + dz,
    ).applyMatrix4(m);

    // Should be mostly +X with very small Y and Z components.
    expect(localOffset.x).toBeGreaterThan(0.3);
    expect(Math.abs(localOffset.y)).toBeLessThan(0.05);
    expect(Math.abs(localOffset.z)).toBeLessThan(0.05);
  });
});
