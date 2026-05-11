import { describe, it, expect } from 'vitest';
import { processGpx, toElevationProfile } from './GpxProcessor';

// L-shaped path: climbs north then descends east. The corner is far off the
// start→end line (~600 m perpendicular), so RDP always keeps it and
// elevation_gain / elevation_loss are non-zero after thinning.
const MINIMAL_GPX = `<?xml version="1.0"?>
<gpx>
  <trk>
    <name>Test Trail</name>
    <trkseg>
      <trkpt lat="48.000000" lon="11.500000"><ele>500</ele></trkpt>
      <trkpt lat="48.002000" lon="11.501000"><ele>520</ele></trkpt>
      <trkpt lat="48.004000" lon="11.502000"><ele>540</ele></trkpt>
      <trkpt lat="48.006000" lon="11.503000"><ele>570</ele></trkpt>
      <trkpt lat="48.008000" lon="11.504000"><ele>600</ele></trkpt>
      <trkpt lat="48.008000" lon="11.507000"><ele>580</ele></trkpt>
      <trkpt lat="48.008000" lon="11.510000"><ele>560</ele></trkpt>
      <trkpt lat="48.008000" lon="11.513000"><ele>540</ele></trkpt>
      <trkpt lat="48.008000" lon="11.516000"><ele>520</ele></trkpt>
      <trkpt lat="48.008000" lon="11.519000"><ele>500</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const TIMED_GPX = `<?xml version="1.0"?>
<gpx>
  <trk>
    <name>Timed Trail</name>
    <trkseg>
      <trkpt lat="48.000000" lon="11.500000">
        <ele>500</ele>
        <time>2024-06-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="48.001000" lon="11.501000">
        <ele>510</ele>
        <time>2024-06-01T10:05:00Z</time>
      </trkpt>
      <trkpt lat="48.002000" lon="11.502000">
        <ele>520</ele>
        <time>2024-06-01T10:10:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('processGpx', () => {
  it('returns null for empty or invalid GPX', () => {
    expect(processGpx('')).toBeNull();
    expect(processGpx('<gpx></gpx>')).toBeNull();
  });

  it('parses the trail name from the GPX', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result?.suggestedName).toBe('Test Trail');
  });

  it('returns gpxPoints as [lat, lng, alt] tuples', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result).not.toBeNull();
    expect(result!.gpxPoints.length).toBeGreaterThan(0);
    for (const p of result!.gpxPoints) {
      expect(p).toHaveLength(3);
      expect(typeof p[0]).toBe('number'); // lat
      expect(typeof p[1]).toBe('number'); // lng
      expect(typeof p[2]).toBe('number'); // alt
    }
  });

  it('computes positive elevation gain for an ascending trail', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.elevation_gain).toBeGreaterThan(0);
  });

  it('computes positive elevation loss for a descending section', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.elevation_loss).toBeGreaterThan(0);
  });

  it('computes a positive distance', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.distance_km).toBeGreaterThan(0);
  });

  it('sets rawCount to the number of input trackpoints', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.rawCount).toBe(10);
  });

  it('thinnedCount is <= rawCount (RDP never adds points)', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.thinnedCount).toBeLessThanOrEqual(result!.rawCount);
  });

  it('computes duration_minutes from timestamps when present', () => {
    const result = processGpx(TIMED_GPX);
    expect(result!.duration_minutes).toBe(10);
  });

  it('sets duration_minutes to null when no timestamps', () => {
    const result = processGpx(MINIMAL_GPX);
    expect(result!.duration_minutes).toBeNull();
  });

  it('includes elevationProfile with monotonically increasing dist', () => {
    const result = processGpx(MINIMAL_GPX);
    const profile = result!.elevationProfile;
    expect(profile.length).toBeGreaterThan(0);
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i].dist).toBeGreaterThanOrEqual(profile[i - 1].dist);
    }
  });
});

describe('toElevationProfile', () => {
  it('returns empty array for empty input', () => {
    expect(toElevationProfile([])).toEqual([]);
  });

  it('first point always has dist 0', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.001, 11.501, 510],
    ];
    const profile = toElevationProfile(points);
    expect(profile[0].dist).toBe(0);
  });

  it('distance increases for subsequent points', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.01, 11.51, 520],
      [48.02, 11.52, 540],
    ];
    const profile = toElevationProfile(points);
    expect(profile[1].dist).toBeGreaterThan(0);
    expect(profile[2].dist).toBeGreaterThan(profile[1].dist);
  });

  it('preserves altitude values', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.001, 11.501, 600],
    ];
    const profile = toElevationProfile(points);
    expect(profile[0].alt).toBe(500);
    expect(profile[1].alt).toBe(600);
  });
});
