import { describe, it, expect } from '@jest/globals';
import { chainIntoPolygon, BOUNDARY_LABEL } from '../dxf-parse';

describe('chainIntoPolygon', () => {
  it('returns null for fewer than 3 segments', () => {
    expect(
      chainIntoPolygon([
        { id: '1', ax: 0, ay: 0, bx: 1, by: 0, layer: '0' },
      ]),
    ).toBeNull();
  });

  it('returns null when segments do not close', () => {
    // Three disjoint lines
    const res = chainIntoPolygon([
      { id: '1', ax: 0, ay: 0, bx: 10, by: 0, layer: '0' },
      { id: '2', ax: 100, ay: 100, bx: 110, by: 100, layer: '0' },
      { id: '3', ax: 200, ay: 200, bx: 210, by: 200, layer: '0' },
    ]);
    expect(res).toBeNull();
  });

  it('chains a simple rectangle', () => {
    const res = chainIntoPolygon([
      { id: '1', ax: 0, ay: 0, bx: 10, by: 0, layer: '0' },
      { id: '2', ax: 10, ay: 0, bx: 10, by: 20, layer: '0' },
      { id: '3', ax: 10, ay: 20, bx: 0, by: 20, layer: '0' },
      { id: '4', ax: 0, ay: 20, bx: 0, by: 0, layer: '0' },
    ]);
    expect(res).not.toBeNull();
    expect(res!.length).toBe(4);
  });

  it('handles segments in arbitrary order with flipped endpoints', () => {
    // A triangle, but segments are shuffled and some reversed
    const res = chainIntoPolygon([
      { id: '1', ax: 10, ay: 0, bx: 5, by: 10, layer: '0' },
      { id: '2', ax: 0, ay: 0, bx: 10, by: 0, layer: '0' },
      { id: '3', ax: 5, ay: 10, bx: 0, by: 0, layer: '0' },
    ]);
    expect(res).not.toBeNull();
    expect(res!.length).toBe(3);
  });
});

describe('BOUNDARY_LABEL', () => {
  it('has Japanese labels for every kind', () => {
    expect(BOUNDARY_LABEL.site).toBe('敷地境界');
    expect(BOUNDARY_LABEL.road).toBe('道路境界');
    expect(BOUNDARY_LABEL.adjacent).toBe('隣地境界');
    expect(BOUNDARY_LABEL.north).toBe('北側境界');
  });
});
