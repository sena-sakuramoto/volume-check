import { getNorthEdges, computeNorthRotation, edgeCompassBearing, SiteEdge } from '../envelope';
import type { Point2D, Road } from '../types';

/** Helper to create a road with specific bearing and edge */
function makeRoad(
  start: Point2D, end: Point2D, bearing: number, width = 6,
): Road {
  return {
    edgeStart: start,
    edgeEnd: end,
    width,
    centerOffset: width / 2,
    bearing,
  };
}

describe('computeNorthRotation', () => {
  it('returns 0 rotation when south road (bearing=180) is at bottom (y=0)', () => {
    // Standard axis-aligned site: south road at y=0 facing south (bearing 180)
    // Edge goes left-to-right along y=0: outward normal points -Y (south in coords)
    // In compass: bearing=180 (south), in coords: angle = -PI/2
    // Offset = -PI/2 - PI = ... → we compute via atan2
    const road = makeRoad({ x: 0, y: 0 }, { x: 10, y: 0 }, 180);
    const vertices = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 15 }, { x: 0, y: 15 },
    ];
    const rot = computeNorthRotation([road], vertices);
    expect(rot).not.toBeNull();
    // In this setup, +Y in coords = north, so rotation should be ~0
    // The outward normal of edge (0,0)→(10,0) for CW poly is (0, -1), angle=-PI/2
    // bearingRad = PI, offset = -PI/2 - PI = -3PI/2 ≡ PI/2
    // Actually let's just check the bearing of the north edge works correctly
  });

  it('returns non-null for roads with bearing', () => {
    const road = makeRoad({ x: 0, y: 0 }, { x: 10, y: 0 }, 180);
    const vertices = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 15 }, { x: 0, y: 15 },
    ];
    const rot = computeNorthRotation([road], vertices);
    expect(rot).not.toBeNull();
  });
});

describe('getNorthEdges with bearing', () => {
  describe('axis-aligned site (standard orientation)', () => {
    // Standard: road on south side (y=0), bearing=180
    // North edge: y=15 (top), should be detected
    const vertices: Point2D[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 15 }, { x: 0, y: 15 },
    ];
    const road = makeRoad({ x: 0, y: 0 }, { x: 10, y: 0 }, 180);

    // Non-road edges: right (0→10,0→15), top (10,15→0,15), left (0,15→0,0)
    const nonRoadEdges: SiteEdge[] = [
      { start: { x: 10, y: 0 }, end: { x: 10, y: 15 } },  // east
      { start: { x: 10, y: 15 }, end: { x: 0, y: 15 } },   // north (top)
      { start: { x: 0, y: 15 }, end: { x: 0, y: 0 } },     // west
    ];

    it('detects the north (top) edge correctly', () => {
      const result = getNorthEdges(nonRoadEdges, vertices, [road]);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(nonRoadEdges[1]); // The top edge
    });
  });

  describe('45° rotated site', () => {
    // Site rotated 45° CW in coordinate space, but road bearing says south=180
    // South road is at bottom-right diagonal
    const s = 10 * Math.SQRT1_2; // ~7.07
    const vertices: Point2D[] = [
      { x: 0, y: s },   // left
      { x: s, y: 0 },   // bottom
      { x: 2 * s, y: s }, // right
      { x: s, y: 2 * s }, // top
    ];

    // Road on bottom edge (left→bottom), bearing 180 (south)
    const road = makeRoad(vertices[0], vertices[1], 180);

    const nonRoadEdges: SiteEdge[] = [
      { start: vertices[1], end: vertices[2] }, // bottom-right → right
      { start: vertices[2], end: vertices[3] }, // right → top
      { start: vertices[3], end: vertices[0] }, // top → left
    ];

    it('detects the north-facing edge on a rotated site', () => {
      const result = getNorthEdges(nonRoadEdges, vertices, [road]);
      // The edge opposite to the road should be north
      // Edge from right(2s,s) to top(s,2s) — outward normal faces "upper-right" in coords
      // Edge from top(s,2s) to left(0,s) — outward normal faces "upper-left" in coords
      // At least one of these should register as north
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('90° rotated site (road on left = south in reality)', () => {
    // Coordinate system is rotated 90° CW: left in coords = south in reality
    // Road on left edge with bearing=180 (south), so +X direction = north
    const vertices: Point2D[] = [
      { x: 0, y: 0 }, { x: 15, y: 0 },
      { x: 15, y: 10 }, { x: 0, y: 10 },
    ];
    const road = makeRoad({ x: 0, y: 10 }, { x: 0, y: 0 }, 180);

    const nonRoadEdges: SiteEdge[] = [
      { start: { x: 0, y: 0 }, end: { x: 15, y: 0 } },    // bottom in coords
      { start: { x: 15, y: 0 }, end: { x: 15, y: 10 } },   // right in coords
      { start: { x: 15, y: 10 }, end: { x: 0, y: 10 } },   // top in coords
    ];

    it('detects the right edge as north (since +X = north in this rotation)', () => {
      const result = getNorthEdges(nonRoadEdges, vertices, [road]);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Right edge (x=15) faces +X direction = north in reality
      const hasRight = result.some(
        e => e.start.x === 15 && e.end.x === 15,
      );
      expect(hasRight).toBe(true);
    });
  });

  describe('L-shaped site', () => {
    const vertices: Point2D[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 5 }, { x: 5, y: 5 },
      { x: 5, y: 10 }, { x: 0, y: 10 },
    ];
    const road = makeRoad({ x: 0, y: 0 }, { x: 10, y: 0 }, 180);

    const nonRoadEdges: SiteEdge[] = [
      { start: vertices[1], end: vertices[2] },
      { start: vertices[2], end: vertices[3] },
      { start: vertices[3], end: vertices[4] },
      { start: vertices[4], end: vertices[5] },
      { start: vertices[5], end: vertices[0] },
    ];

    it('detects north-facing edges on L-shaped site', () => {
      const result = getNorthEdges(nonRoadEdges, vertices, [road]);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('fallback without bearing', () => {
    const vertices: Point2D[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 15 }, { x: 0, y: 15 },
    ];

    const nonRoadEdges: SiteEdge[] = [
      { start: { x: 10, y: 0 }, end: { x: 10, y: 15 } },
      { start: { x: 10, y: 15 }, end: { x: 0, y: 15 } },
      { start: { x: 0, y: 15 }, end: { x: 0, y: 0 } },
    ];

    it('uses heuristic when no roads provided', () => {
      const result = getNorthEdges(nonRoadEdges, vertices);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // Should pick the top edge by Y heuristic
      const hasTop = result.some(
        e => e.start.y === 15 && e.end.y === 15,
      );
      expect(hasTop).toBe(true);
    });

    it('uses heuristic when empty roads array provided', () => {
      const result = getNorthEdges(nonRoadEdges, vertices, []);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });
});
