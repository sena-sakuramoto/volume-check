interface TilePoint {
  x: number;
  y: number;
}

export function latLngToTile(lat: number, lng: number, z: number): { tileX: number; tileY: number } {
  const n = Math.pow(2, z);
  const tileX = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { tileX, tileY };
}

export function latLngToPixel(
  lat: number,
  lng: number,
  z: number,
  tileX: number,
  tileY: number,
  extent: number,
): { pixelX: number; pixelY: number } {
  const n = Math.pow(2, z);
  const latRad = (lat * Math.PI) / 180;
  const pixelX = (((lng + 180) / 360) * n - tileX) * extent;
  const pixelY =
    (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n - tileY) *
    extent;
  return { pixelX, pixelY };
}

export function pointInPolygon(px: number, py: number, ring: TilePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function signedArea(ring: TilePoint[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[i].y + ring[j].y);
  }
  return sum;
}

export function pointInFeatureGeometry(
  px: number,
  py: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feature: any,
): boolean {
  const geomType = feature.type;
  const geometry: TilePoint[][] = feature.loadGeometry();

  if (geomType === 3) {
    let insideOuter = false;
    let insideHole = false;
    for (const ring of geometry) {
      const area = signedArea(ring);
      if (area > 0) {
        if (insideOuter && !insideHole) return true;
        insideOuter = pointInPolygon(px, py, ring);
        insideHole = false;
      } else if (insideOuter && pointInPolygon(px, py, ring)) {
        insideHole = true;
      }
    }
    return insideOuter && !insideHole;
  }

  if (geomType === 1) {
    for (const ring of geometry) {
      for (const pt of ring) {
        const dx = pt.x - px;
        const dy = pt.y - py;
        if (dx * dx + dy * dy < 100) return true;
      }
    }
  }
  return false;
}

export async function fetchMvtTile(
  urlTemplate: string,
  z: number,
  x: number,
  y: number,
): Promise<import('@mapbox/vector-tile').VectorTile | null> {
  const Pbf = (await import('pbf')).default;
  const { VectorTile } = await import('@mapbox/vector-tile');

  const url = urlTemplate.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new VectorTile(new Pbf(new Uint8Array(buf)));
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
