/**
 * WGS84 ECEF ↔ Geodetic ↔ local ENU helpers.
 *
 * PLATEAU 3D Tiles are authored in ECEF (`EPSG:4978`). To place them in a
 * local metric frame anchored at (lat0, lng0) we need to rotate + translate
 * tile-space vertices into an east-north-up (ENU) basis.
 *
 * Accuracy is sufficient for a few-hundred-meter neighborhood. For longer
 * distances switch to proj4 / turf (not needed for VOLANS' current scope).
 */

import * as THREE from 'three';

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** Geodetic (lat°, lng°, alt m) → ECEF (x, y, z) meters */
export function geodeticToEcef(lat: number, lng: number, alt = 0): {
  x: number;
  y: number;
  z: number;
} {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (N + alt) * cosLat * Math.cos(lngR);
  const y = (N + alt) * cosLat * Math.sin(lngR);
  const z = (N * (1 - WGS84_E2) + alt) * sinLat;
  return { x, y, z };
}

/**
 * Build a Three.js Matrix4 that transforms an ECEF position into a local ENU
 * frame anchored at (lat0, lng0). In the resulting frame:
 *   +X = East, +Y = Up, +Z = -North  (matches Three's right-handed,
 *   y-up convention used throughout VOLANS' site coordinates).
 *
 * Apply with `group.matrixAutoUpdate = false; group.matrix.copy(result)`.
 */
export function ecefToLocalEnuMatrix(lat0: number, lng0: number, alt0 = 0): THREE.Matrix4 {
  const latR = (lat0 * Math.PI) / 180;
  const lngR = (lng0 * Math.PI) / 180;
  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const sinLng = Math.sin(lngR);
  const cosLng = Math.cos(lngR);

  const origin = geodeticToEcef(lat0, lng0, alt0);

  // ENU basis vectors in ECEF:
  //   east  = [-sin(lng),            cos(lng),           0       ]
  //   north = [-sin(lat)*cos(lng), -sin(lat)*sin(lng), cos(lat)]
  //   up    = [ cos(lat)*cos(lng),  cos(lat)*sin(lng), sin(lat)]
  //
  // We want the inverse transform (ECEF → ENU), which is the transpose of the
  // rotation above, then the translation to the origin.
  //
  // Three maps ENU to its own basis: E→X, U→Y, N→-Z. So row 3 of the matrix
  // uses -north.
  const m = new THREE.Matrix4();
  m.set(
    -sinLng,          cosLng,           0,        0,
    cosLat * cosLng,  cosLat * sinLng,  sinLat,   0,
    sinLat * cosLng,  sinLat * sinLng, -cosLat,   0,
    0,                0,                0,        1,
  );
  // Translation: subtract ECEF origin before applying rotation.
  const t = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
  return m.multiply(t);
}
