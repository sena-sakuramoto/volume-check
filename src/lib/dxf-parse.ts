import DxfParser from 'dxf-parser';

export interface DxfLine {
  id: string;
  /** Endpoint A in DXF local coords (meters assumed) */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Source layer name, useful as a hint */
  layer: string;
}

export interface DxfParseResult {
  lines: DxfLine[];
  /** bbox of all geometry (for fitting the SVG viewBox) */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** unique layer names, sorted */
  layers: string[];
}

interface DxfEntity {
  type?: string;
  layer?: string;
  vertices?: Array<{ x?: number; y?: number }>;
  shape?: boolean;
  closed?: boolean;
}

interface DxfLineEntity extends DxfEntity {
  type: 'LINE';
  vertices: [{ x: number; y: number }, { x: number; y: number }];
}

interface DxfPolylineEntity extends DxfEntity {
  type: 'LWPOLYLINE' | 'POLYLINE';
  vertices: Array<{ x: number; y: number }>;
  shape?: boolean;
}

/**
 * Parse DXF text (from FileReader.readAsText) into a flat list of 2D line segments
 * with layer labels. LINE, LWPOLYLINE and legacy POLYLINE entities are expanded.
 * Curves (SPLINE, ARC, CIRCLE) are ignored for now.
 */
export function parseDxf(text: string): DxfParseResult {
  const parser = new DxfParser();
  const dxf = parser.parseSync(text);
  if (!dxf || !Array.isArray(dxf.entities)) {
    return {
      lines: [],
      bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      layers: [],
    };
  }

  const lines: DxfLine[] = [];
  let idx = 0;
  const pushLine = (layer: string, ax: number, ay: number, bx: number, by: number) => {
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
      return;
    }
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) return;
    lines.push({
      id: `ln-${idx++}`,
      ax,
      ay,
      bx,
      by,
      layer: layer || '0',
    });
  };

  for (const raw of dxf.entities as DxfEntity[]) {
    const layer = raw.layer ?? '0';
    if (raw.type === 'LINE') {
      const e = raw as DxfLineEntity;
      if (!e.vertices || e.vertices.length < 2) continue;
      pushLine(layer, e.vertices[0].x, e.vertices[0].y, e.vertices[1].x, e.vertices[1].y);
    } else if (raw.type === 'LWPOLYLINE' || raw.type === 'POLYLINE') {
      const e = raw as DxfPolylineEntity;
      if (!e.vertices || e.vertices.length < 2) continue;
      const verts = e.vertices;
      for (let i = 0; i < verts.length - 1; i++) {
        const a = verts[i];
        const b = verts[i + 1];
        if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) continue;
        pushLine(layer, a.x, a.y, b.x, b.y);
      }
      if (e.shape || e.closed) {
        const a = verts[verts.length - 1];
        const b = verts[0];
        if (
          a.x !== undefined &&
          a.y !== undefined &&
          b.x !== undefined &&
          b.y !== undefined
        ) {
          pushLine(layer, a.x, a.y, b.x, b.y);
        }
      }
    }
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const l of lines) {
    minX = Math.min(minX, l.ax, l.bx);
    minY = Math.min(minY, l.ay, l.by);
    maxX = Math.max(maxX, l.ax, l.bx);
    maxY = Math.max(maxY, l.ay, l.by);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }

  const layerSet = new Set<string>();
  for (const l of lines) layerSet.add(l.layer);
  const layers = Array.from(layerSet).sort();

  return { lines, bbox: { minX, minY, maxX, maxY }, layers };
}

export type BoundaryKind = 'site' | 'road' | 'adjacent' | 'north' | 'ignore';

export const BOUNDARY_LABEL: Record<BoundaryKind, string> = {
  site: '敷地境界',
  road: '道路境界',
  adjacent: '隣地境界',
  north: '北側境界',
  ignore: '無視',
};

export const BOUNDARY_COLOR: Record<BoundaryKind, string> = {
  site: '#3b6de1',
  road: '#f19342',
  adjacent: '#22a06b',
  north: '#a855f7',
  ignore: '#94a3b8',
};

/**
 * Chain selected 敷地境界 line segments into a closed polygon ring, matching
 * endpoints within `tolerance` meters. Returns vertices in DXF local coords.
 * Returns null if the segments don't close.
 */
export function chainIntoPolygon(
  lines: DxfLine[],
  tolerance = 0.05,
): Array<{ x: number; y: number }> | null {
  if (lines.length < 3) return null;
  const segs = lines.map((l) => ({
    a: { x: l.ax, y: l.ay },
    b: { x: l.bx, y: l.by },
    used: false,
  }));

  const close = (p: { x: number; y: number }, q: { x: number; y: number }) =>
    Math.hypot(p.x - q.x, p.y - q.y) <= tolerance;

  // Start from the first segment
  const first = segs[0];
  first.used = true;
  const ring: Array<{ x: number; y: number }> = [first.a, first.b];

  while (true) {
    const tail = ring[ring.length - 1];
    let found = false;
    for (const s of segs) {
      if (s.used) continue;
      if (close(s.a, tail)) {
        ring.push(s.b);
        s.used = true;
        found = true;
        break;
      }
      if (close(s.b, tail)) {
        ring.push(s.a);
        s.used = true;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (close(ring[ring.length - 1], ring[0])) {
      // closed
      ring.pop();
      return ring;
    }
  }
  return null;
}
