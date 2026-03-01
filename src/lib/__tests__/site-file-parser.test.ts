import { parseCSV, parseGeoJSON, parseSiteFile } from '../site-file-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const squareCSV_3col = [
  'point_no,x,y',
  '1,0,0',
  '2,10,0',
  '3,10,10',
  '4,0,10',
].join('\n');

const squareCSV_2col = ['0,0', '10,0', '10,10', '0,10'].join('\n');

function makePolygonFeature(
  coords: number[][],
  properties: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    type: 'Feature',
    properties,
    geometry: { type: 'Polygon', coordinates: [coords] },
  });
}

const tokyoSquareCoords: number[][] = [
  [139.7671, 35.6812],
  [139.7672, 35.6812],
  [139.7672, 35.6813],
  [139.7671, 35.6813],
  [139.7671, 35.6812],
];

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

describe('parseCSV', () => {
  it('parses 3-column CSV with header', () => {
    const result = parseCSV(squareCSV_3col);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.site.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(result.site.vertices[1]).toEqual({ x: 10, y: 0 });
    expect(result.site.vertices[2]).toEqual({ x: 10, y: 10 });
    expect(result.site.vertices[3]).toEqual({ x: 0, y: 10 });
    expect(result.roads).toEqual([]);
  });

  it('parses 2-column CSV without header', () => {
    const result = parseCSV(squareCSV_2col);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.site.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(result.site.vertices[3]).toEqual({ x: 0, y: 10 });
  });

  it('auto-detects header row starting with letters', () => {
    const csv = ['x_coord,y_coord', '0,0', '10,0', '10,10', '0,10'].join('\n');
    const result = parseCSV(csv);
    expect(result.site.vertices).toHaveLength(4);
  });

  it('auto-detects header containing "point"', () => {
    const csv = ['Point,X,Y', '1,5,5', '2,15,5', '3,10,15'].join('\n');
    const result = parseCSV(csv);
    expect(result.site.vertices).toHaveLength(3);
  });

  it('throws on empty file', () => {
    expect(() => parseCSV('')).toThrow('CSVファイルが空です');
    expect(() => parseCSV('   \n\n  ')).toThrow('CSVファイルが空です');
  });

  it('throws when fewer than 3 vertices', () => {
    const csv = ['1,0,0', '2,10,0'].join('\n');
    expect(() => parseCSV(csv)).toThrow('3点以上の頂点が必要です');
  });

  it('throws on invalid numbers', () => {
    const csv = ['abc,def', 'ghi,jkl', 'mno,pqr'].join('\n');
    expect(() => parseCSV(csv)).toThrow();
  });

  it('calculates area correctly for a 10x10 square', () => {
    const result = parseCSV(squareCSV_3col);
    expect(result.site.area).toBeCloseTo(100, 5);
  });

  it('calculates area correctly for a right triangle', () => {
    const csv = ['0,0', '10,0', '0,10'].join('\n');
    const result = parseCSV(csv);
    expect(result.site.area).toBeCloseTo(50, 5);
  });

  it('skips malformed lines gracefully', () => {
    const csv = [
      'point_no,x,y',
      '1,0,0',
      'this is garbage',
      '2,10,0',
      '---',
      '3,10,10',
      '4,0,10',
    ].join('\n');
    const result = parseCSV(csv);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.site.area).toBeCloseTo(100, 5);
  });

  it('handles Windows-style CRLF line endings', () => {
    const csv = 'point_no,x,y\r\n1,0,0\r\n2,10,0\r\n3,10,10\r\n4,0,10\r\n';
    const result = parseCSV(csv);
    expect(result.site.vertices).toHaveLength(4);
  });

  it('includes vertex count and area in notes', () => {
    const result = parseCSV(squareCSV_3col);
    expect(result.notes).toContain('4頂点');
    expect(result.notes).toContain('100.0m');
  });
});

// ---------------------------------------------------------------------------
// GeoJSON Parser
// ---------------------------------------------------------------------------

describe('parseGeoJSON', () => {
  it('parses a Feature with Polygon geometry', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseGeoJSON(geojson);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.site.area).toBeGreaterThan(0);
  });

  it('parses a FeatureCollection and picks the first Polygon', () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [139.7671, 35.6812] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [tokyoSquareCoords] } },
      ],
    });
    const result = parseGeoJSON(fc);
    expect(result.site.vertices).toHaveLength(4);
  });

  it('parses a bare Polygon geometry', () => {
    const bare = JSON.stringify({ type: 'Polygon', coordinates: [tokyoSquareCoords] });
    const result = parseGeoJSON(bare);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.site.area).toBeGreaterThan(0);
  });

  it('converts WGS84 coordinates to local meters centred near origin', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseGeoJSON(geojson);
    const xs = result.site.vertices.map((v) => v.x);
    const ys = result.site.vertices.map((v) => v.y);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    expect(Math.abs(meanX)).toBeLessThan(1);
    expect(Math.abs(meanY)).toBeLessThan(1);
    const extentX = Math.max(...xs) - Math.min(...xs);
    const extentY = Math.max(...ys) - Math.min(...ys);
    expect(extentX).toBeGreaterThan(1);
    expect(extentX).toBeLessThan(100);
    expect(extentY).toBeGreaterThan(1);
    expect(extentY).toBeLessThan(200);
  });

  it('removes closing duplicate point', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseGeoJSON(geojson);
    expect(result.site.vertices).toHaveLength(4);
    const first = result.site.vertices[0];
    const last = result.site.vertices[result.site.vertices.length - 1];
    expect(first.x !== last.x || first.y !== last.y).toBe(true);
  });

  it('reads area from properties when provided', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords, { area: 250.5 });
    const result = parseGeoJSON(geojson);
    expect(result.site.area).toBe(250.5);
  });

  it('reads roads from properties', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords, {
      roads: [
        { width: 8, edgeVertexIndices: [0, 1] },
        { width: 4, edgeVertexIndices: [2, 3] },
      ],
    });
    const result = parseGeoJSON(geojson);
    expect(result.roads).toHaveLength(2);
    expect(result.roads[0].width).toBe(8);
    expect(result.roads[1].width).toBe(4);
    for (const road of result.roads) {
      expect(road.edgeStart).toBeDefined();
      expect(road.edgeEnd).toBeDefined();
      expect(typeof road.bearing).toBe('number');
      expect(road.centerOffset).toBe(road.width / 2);
    }
  });

  it('defaults road width to 6 when not specified', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords, {
      roads: [{ edgeVertexIndices: [0, 1] }],
    });
    const result = parseGeoJSON(geojson);
    expect(result.roads[0].width).toBe(6);
    expect(result.roads[0].centerOffset).toBe(3);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseGeoJSON('not json')).toThrow('GeoJSONのパースに失敗しました');
  });

  it('throws when no Polygon found in FeatureCollection', () => {
    const fc = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [139.7, 35.6] } },
      ],
    });
    expect(() => parseGeoJSON(fc)).toThrow('Polygonタイプのジオメトリが見つかりません');
  });

  it('throws when Feature geometry is not Polygon', () => {
    const feat = JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
    });
    expect(() => parseGeoJSON(feat)).toThrow('Polygonタイプのジオメトリが必要です');
  });

  it('throws when fewer than 3 points', () => {
    const feat = JSON.stringify({ type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] });
    expect(() => parseGeoJSON(feat)).toThrow('3点以上の座標が必要です');
  });

  it('throws when FeatureCollection is empty', () => {
    const fc = JSON.stringify({ type: 'FeatureCollection', features: [] });
    expect(() => parseGeoJSON(fc)).toThrow('FeatureCollectionにFeatureがありません');
  });

  it('throws on unsupported GeoJSON type', () => {
    const geo = JSON.stringify({ type: 'MultiPolygon', coordinates: [] });
    expect(() => parseGeoJSON(geo)).toThrow('対応するGeoJSONタイプ');
  });

  it('extracts latitude from WGS84 coordinates', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseGeoJSON(geojson);
    expect(result.latitude).toBeDefined();
    expect(result.latitude!).toBeCloseTo(35.6812, 2);
  });

  it('does not set latitude for meter-based coordinates', () => {
    const meterCoords = [[1000, 2000], [1010, 2000], [1010, 2010], [1000, 2010], [1000, 2000]];
    const feat = JSON.stringify({ type: 'Polygon', coordinates: [meterCoords] });
    const result = parseGeoJSON(feat);
    expect(result.latitude).toBeUndefined();
    expect(result.site.vertices[0]).toEqual({ x: 1000, y: 2000 });
  });

  it('includes coordinate type in notes', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    expect(parseGeoJSON(geojson).notes).toContain('WGS84座標');

    const meterCoords = [[1000, 2000], [1010, 2000], [1010, 2010], [1000, 2010], [1000, 2000]];
    const meterJson = JSON.stringify({ type: 'Polygon', coordinates: [meterCoords] });
    expect(parseGeoJSON(meterJson).notes).toContain('平面直角座標');
  });
});

// ---------------------------------------------------------------------------
// parseSiteFile dispatcher
// ---------------------------------------------------------------------------

describe('parseSiteFile', () => {
  it('dispatches .csv to CSV parser', () => {
    const result = parseSiteFile('site.csv', squareCSV_3col);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.notes).toContain('CSV');
  });

  it('dispatches .geojson to GeoJSON parser', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseSiteFile('boundary.geojson', geojson);
    expect(result.site.vertices).toHaveLength(4);
    expect(result.notes).toContain('GeoJSON');
  });

  it('dispatches .json to GeoJSON parser', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseSiteFile('data.json', geojson);
    expect(result.notes).toContain('GeoJSON');
  });

  it('auto-detects JSON content without known extension', () => {
    const geojson = makePolygonFeature(tokyoSquareCoords);
    const result = parseSiteFile('noext', geojson);
    expect(result.notes).toContain('GeoJSON');
  });

  it('falls back to CSV parser for non-JSON content', () => {
    const result = parseSiteFile('noext', squareCSV_2col);
    expect(result.notes).toContain('CSV');
  });

  it('handles uppercase extensions', () => {
    const result = parseSiteFile('SITE.CSV', squareCSV_3col);
    expect(result.notes).toContain('CSV');
  });
});
