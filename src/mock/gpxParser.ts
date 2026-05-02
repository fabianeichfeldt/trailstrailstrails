/**
 * Extracts track points from a GPX string.
 * Works with a full GPX file or a bare snippet of <trkpt> elements.
 * Missing <ele> defaults to 0.
 */
export function parseGpx(gpxString: string): [number, number, number][] {
  const points: [number, number, number][] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(gpxString)) !== null) {
    const attrs = m[1];
    const body  = m[2];
    const lat   = parseFloat(attrs.match(/lat="([^"]+)"/)?.[1] ?? 'NaN');
    const lon   = parseFloat(attrs.match(/lon="([^"]+)"/)?.[1] ?? 'NaN');
    const ele   = parseFloat(body.match(/<ele>([\d.eE+-]+)<\/ele>/)?.[1] ?? '0');

    if (!isNaN(lat) && !isNaN(lon))
      points.push([lat, lon, Math.round(isNaN(ele) ? 0 : ele)]);
  }

  return points;
}
