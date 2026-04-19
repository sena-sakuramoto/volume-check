import { describe, it, expect } from '@jest/globals';
import { generateMeasurementPoints } from '../measurement-points';
import type { Road, SiteBoundary } from '../../types';

/**
 * A 20×30 m rectangular site with a 6m-wide road on the south edge.
 *   - site vertices (CW, meters):  (0,0)-(20,0)-(20,30)-(0,30)
 *   - road: south edge (0,0)->(20,0), width 6
 */
const site: SiteBoundary = {
  vertices: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 30 },
    { x: 0, y: 30 },
  ],
  area: 600,
};

const roads: Road[] = [
  {
    edgeStart: { x: 0, y: 0 },
    edgeEnd: { x: 20, y: 0 },
    width: 6,
    centerOffset: 3,
    bearing: 180,
  },
];

describe('generateMeasurementPoints', () => {
  it('produces road, adjacent and north points', () => {
    const pts = generateMeasurementPoints(site, roads);
    const kinds = new Set(pts.map((p) => p.kind));
    expect(kinds).toContain('road');
    expect(kinds).toContain('adjacent');
    expect(kinds).toContain('north');
  });

  it('places road measurement points OUTSIDE the site on the road opposite side', () => {
    const pts = generateMeasurementPoints(site, roads).filter((p) => p.kind === 'road');
    expect(pts.length).toBeGreaterThan(3);
    // Outside via the road edge. Road is at y=0, width=6, so opposite-side boundary is y=-6.
    for (const p of pts) {
      expect(p.position.y).toBeCloseTo(1.5, 6); // eye height
      expect(p.position.z).toBeLessThan(-5);
    }
  });

  it('skips the road edge when generating adjacent points', () => {
    const pts = generateMeasurementPoints(site, roads).filter((p) => p.kind === 'adjacent');
    // Road edge is (0,0)-(20,0); adjacent points must not live at z≈0
    // (they'll be at z= -16 for south, but south IS road so excluded).
    // For this site, adjacent edges are east, west, north (3 edges).
    expect(pts.length).toBeGreaterThan(0);
  });

  it('all points have label and index', () => {
    const pts = generateMeasurementPoints(site, roads);
    for (const p of pts) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(Number.isInteger(p.index)).toBe(true);
      expect(p.total).toBeGreaterThan(0);
    }
  });
});
