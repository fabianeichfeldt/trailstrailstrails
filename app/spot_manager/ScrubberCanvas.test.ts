import { describe, it, expect } from 'vitest';
import type { GpxPoint } from './GpxProcessor';
import { computeSmoothedAlts, handleXPosition, indexAtCanvasX } from './ScrubberCanvas';

// PAD = { left: 38, right: 18 } in ScrubberCanvas.ts; chart width = canvasWidth - 56.
const pt = (alt: number): GpxPoint => ({ lat: 0, lng: 0, alt, time: null });

describe('computeSmoothedAlts', () => {
  it('includes a neighbour at exactly 75 m on the left', () => {
    // i=1 sees point 0 at 75 m (included) and point 2 at 75 m (included).
    const { smoothedAlts } = computeSmoothedAlts([pt(10), pt(20), pt(40)], [0, 75, 150]);
    expect(smoothedAlts[1]).toBeCloseTo((10 + 20 + 40) / 3, 10);
    // i=2 sees point 1 at 75 m (included), point 0 at 150 m (excluded).
    expect(smoothedAlts[2]).toBeCloseTo((20 + 40) / 2, 10);
  });

  it('includes a neighbour at exactly 75 m on the right', () => {
    const { smoothedAlts } = computeSmoothedAlts([pt(10), pt(20), pt(40)], [0, 75, 150]);
    // i=0 sees point 1 at 75 m (included), point 2 at 150 m (excluded).
    expect(smoothedAlts[0]).toBeCloseTo((10 + 20) / 2, 10);
  });

  it('excludes a neighbour at 75.1 m on both sides', () => {
    const { smoothedAlts } = computeSmoothedAlts([pt(10), pt(20), pt(40)], [0, 75.1, 150.2]);
    expect(smoothedAlts).toEqual([10, 20, 40]);
  });

  it('averages the altitudes of all neighbours within the window', () => {
    const { smoothedAlts } = computeSmoothedAlts(
      [pt(0), pt(30), pt(60), pt(90)],
      [0, 10, 20, 30],
    );
    expect(smoothedAlts).toEqual([45, 45, 45, 45]);
  });

  it('uses the smoothed values for altMin and altRange', () => {
    const { altMin, altRange, smoothedAlts } = computeSmoothedAlts(
      [pt(10), pt(20), pt(40)],
      [0, 75.1, 150.2],
    );
    expect(smoothedAlts).toEqual([10, 20, 40]);
    expect(altMin).toBe(10);
    expect(altRange).toBe(30);
  });

  it('spans the highest smoothed altitude even when it is not the last point', () => {
    const { altMin, altRange } = computeSmoothedAlts(
      [pt(10), pt(40), pt(20)],
      [0, 75.1, 150.2],
    );
    expect(altMin).toBe(10);
    expect(altRange).toBe(30);
  });

  it('gives altRange 1 for a flat track', () => {
    const { altMin, altRange } = computeSmoothedAlts(
      [pt(50), pt(50), pt(50)],
      [0, 200, 400],
    );
    expect(altMin).toBe(50);
    expect(altRange).toBe(1);
  });

  it('returns no values for an empty track', () => {
    const { smoothedAlts, altMin, altRange } = computeSmoothedAlts([], []);
    expect(smoothedAlts).toEqual([]);
    expect(altMin).toBe(0);
    expect(altRange).toBe(1);
  });
});

describe('handleXPosition', () => {
  it('maps distance 0 to the left pad', () => {
    expect(handleXPosition(0, 1000, 1000)).toBe(38);
  });

  it('maps the total distance to canvasWidth minus the right pad', () => {
    expect(handleXPosition(1000, 1000, 1000)).toBe(982);
  });

  it('maps the midpoint to the middle of the chart', () => {
    expect(handleXPosition(500, 1000, 1000)).toBe(38 + 944 / 2);
  });

  it('returns the left pad instead of NaN when totalDistance is 0', () => {
    const x = handleXPosition(0, 0, 1000);
    expect(x).toBe(38);
    expect(Number.isNaN(x)).toBe(false);
  });
});

describe('indexAtCanvasX', () => {
  // canvasWidth 1000 -> chart spans x 38..982 (944 px)
  const distances = [0, 100, 200, 300];
  const total = 400;

  it('clamps x left of the chart to index 0', () => {
    expect(indexAtCanvasX(0, 1000, distances, total)).toBe(0);
    expect(indexAtCanvasX(37, 1000, distances, total)).toBe(0);
  });

  it('clamps x beyond the right edge to the last index', () => {
    expect(indexAtCanvasX(982, 1000, distances, total)).toBe(3);
    expect(indexAtCanvasX(5000, 1000, distances, total)).toBe(3);
  });

  it('returns the exact index on a hit', () => {
    // distance 100 of 400 -> x = 38 + 0.25 * 944 = 274
    expect(indexAtCanvasX(274, 1000, distances, total)).toBe(1);
  });

  it('returns the lower index when x falls between two points', () => {
    // distance 150 of 400 -> x = 38 + 0.375 * 944 = 392
    expect(indexAtCanvasX(392, 1000, distances, total)).toBe(1);
  });

  it('picks the last index among duplicate distances', () => {
    // distance 100 of 200 -> x = 38 + 0.5 * 944 = 510
    expect(indexAtCanvasX(510, 1000, [0, 100, 100, 200], 200)).toBe(2);
  });

  it('returns 0 for a single-point track', () => {
    expect(indexAtCanvasX(500, 1000, [0], 0)).toBe(0);
    expect(indexAtCanvasX(982, 1000, [0], 100)).toBe(0);
  });
});
