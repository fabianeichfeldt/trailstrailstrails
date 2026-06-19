import type { GpxPoint } from './GpxProcessor';

const PAD = { left: 38, right: 18, top: 10, bottom: 44 };

export interface ScrubberSegment {
  startIdx: number;
  endIdx: number;
  color: string;
}

export interface ScrubberDrawOptions {
  canvas: HTMLCanvasElement;
  points: GpxPoint[];
  distances: number[];
  totalDistance: number;
  smoothedAlts: number[];
  altMin: number;
  altRange: number;
  startIndex: number;
  endIndex: number;
  selectionColor: string;
  committedSegments: readonly ScrubberSegment[];
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function drawScrubberCanvas(opts: ScrubberDrawOptions): void {
  const { canvas, points, distances, totalDistance, smoothedAlts, altMin, altRange,
          startIndex, endIndex, selectionColor, committedSegments } = opts;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const canvasWidth  = canvas.width;
  const canvasHeight = canvas.height;
  if (canvasWidth === 0 || canvasHeight === 0) return;

  const { left: padLeft, right: padRight, top: padTop, bottom: padBottom } = PAD;
  const chartWidth    = canvasWidth  - padLeft - padRight;
  const chartHeight   = canvasHeight - padTop  - padBottom;
  const chartBottom   = padTop + chartHeight;
  const handleCenterY = canvasHeight - padBottom / 2;

  const xAtIndex = (idx: number) =>
    padLeft + (distances[Math.min(idx, distances.length - 1)] / (totalDistance || 1)) * chartWidth;
  const yForAlt = (alt: number) =>
    padTop + chartHeight - ((alt - altMin) / (altRange || 1)) * chartHeight;

  const [selR, selG, selB] = hexToRgb(selectionColor);
  const startX = xAtIndex(startIndex);
  const endX   = xAtIndex(endIndex);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // ── Handle zone background ───────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, chartBottom, canvasWidth, padBottom);

  // ── Full source profile: gradient fill + line ────────────────────────────────
  const sourceGradient = ctx.createLinearGradient(0, padTop, 0, chartBottom);
  sourceGradient.addColorStop(0, 'rgba(180,190,200,0.28)');
  sourceGradient.addColorStop(1, 'rgba(180,190,200,0.04)');
  ctx.beginPath();
  ctx.moveTo(xAtIndex(0), yForAlt(smoothedAlts[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
  ctx.lineTo(xAtIndex(points.length - 1), chartBottom);
  ctx.lineTo(padLeft, chartBottom);
  ctx.closePath();
  ctx.fillStyle = sourceGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xAtIndex(0), yForAlt(smoothedAlts[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
  ctx.strokeStyle = 'rgba(170,180,195,0.5)';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── Committed segments: filled + outlined ────────────────────────────────────
  for (const seg of committedSegments) {
    const [cr, cg, cb] = hexToRgb(seg.color);
    const segGradient = ctx.createLinearGradient(0, padTop, 0, chartBottom);
    segGradient.addColorStop(0, `rgba(${cr},${cg},${cb},0.28)`);
    segGradient.addColorStop(1, `rgba(${cr},${cg},${cb},0.05)`);
    ctx.beginPath();
    ctx.moveTo(xAtIndex(seg.startIdx), yForAlt(smoothedAlts[seg.startIdx]));
    for (let i = seg.startIdx + 1; i <= seg.endIdx; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
    ctx.lineTo(xAtIndex(seg.endIdx), chartBottom);
    ctx.lineTo(xAtIndex(seg.startIdx), chartBottom);
    ctx.closePath();
    ctx.fillStyle = segGradient;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xAtIndex(seg.startIdx), yForAlt(smoothedAlts[seg.startIdx]));
    for (let i = seg.startIdx + 1; i <= seg.endIdx; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
    ctx.strokeStyle = seg.color;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }

  // ── Active selection: gradient fill + solid line ─────────────────────────────
  const selectionGradient = ctx.createLinearGradient(0, padTop, 0, chartBottom);
  selectionGradient.addColorStop(0, `rgba(${selR},${selG},${selB},0.42)`);
  selectionGradient.addColorStop(1, `rgba(${selR},${selG},${selB},0.06)`);
  ctx.beginPath();
  ctx.moveTo(startX, yForAlt(smoothedAlts[startIndex]));
  for (let i = startIndex + 1; i <= endIndex; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
  ctx.lineTo(endX, chartBottom);
  ctx.lineTo(startX, chartBottom);
  ctx.closePath();
  ctx.fillStyle = selectionGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(startX, yForAlt(smoothedAlts[startIndex]));
  for (let i = startIndex + 1; i <= endIndex; i++) ctx.lineTo(xAtIndex(i), yForAlt(smoothedAlts[i]));
  ctx.strokeStyle = selectionColor;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // ── Axis lines ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(padLeft, padTop);      ctx.lineTo(padLeft, chartBottom);               ctx.stroke();
  ctx.beginPath(); ctx.moveTo(padLeft, chartBottom); ctx.lineTo(canvasWidth - padRight, chartBottom); ctx.stroke();

  // ── Y-axis altitude labels ───────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(160,170,185,0.8)';
  ctx.font      = '10px Arial';
  ctx.textAlign = 'right';
  for (const alt of [altMin, altMin + altRange / 2, altMin + altRange]) {
    ctx.fillText(`${Math.round(alt)}`, padLeft - 5, yForAlt(alt) + 3.5);
  }

  // ── X-axis distance labels ───────────────────────────────────────────────────
  ctx.textAlign = 'center';
  const totalKm = totalDistance / 1000;
  for (const fraction of [0, 0.5, 1]) {
    ctx.fillText(`${(totalKm * fraction).toFixed(1)} km`, padLeft + fraction * chartWidth, canvasHeight - 3);
  }

  // ── Selection boundary lines ─────────────────────────────────────────────────
  ctx.lineWidth   = 1.5;
  ctx.strokeStyle = `rgba(${selR},${selG},${selB},0.6)`;
  ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(startX, padTop); ctx.lineTo(startX, chartBottom); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(endX,   padTop); ctx.lineTo(endX,   chartBottom); ctx.stroke();
  ctx.setLineDash([]);

  // ── Handle knobs ─────────────────────────────────────────────────────────────
  const HANDLE_RADIUS = 12;
  for (const [label, handleX] of [['START', startX], ['ENDE', endX]] as [string, number][]) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(handleX, handleCenterY, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = selectionColor;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth   = 1;
    for (const dx of [-2.5, 0, 2.5]) {
      ctx.beginPath();
      ctx.moveTo(handleX + dx, handleCenterY - 4);
      ctx.lineTo(handleX + dx, handleCenterY + 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font      = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, handleX, handleCenterY - HANDLE_RADIUS - 4);
  }

  // ── Distance label between handles ───────────────────────────────────────────
  const selectionKm = Math.round((distances[endIndex] - distances[startIndex]) / 100) / 10;
  ctx.fillStyle = `rgba(${selR},${selG},${selB},1)`;
  ctx.font      = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${selectionKm} km`, (startX + endX) / 2, handleCenterY + 4.5);
}

// Compute per-point smoothed altitudes using a 75 m sliding window radius.
// Smoothing is GPS-density-independent: a point uses all neighbours within 75 m.
export function computeSmoothedAlts(
  points: GpxPoint[],
  distances: number[],
): { smoothedAlts: number[]; altMin: number; altRange: number } {
  const SMOOTH_RADIUS_M = 75;
  let altMin = Infinity, altMax = -Infinity;
  const smoothedAlts = points.map((_, i) => {
    const d = distances[i];
    let lo = i, hi = i;
    while (lo > 0 && d - distances[lo - 1] <= SMOOTH_RADIUS_M) lo--;
    while (hi < points.length - 1 && distances[hi + 1] - d <= SMOOTH_RADIUS_M) hi++;
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += points[j].alt;
    const v = sum / (hi - lo + 1);
    if (v < altMin) altMin = v;
    if (v > altMax) altMax = v;
    return v;
  });
  altMin = altMin === Infinity ? 0 : altMin;
  return { smoothedAlts, altMin, altRange: (altMax - altMin) || 1 };
}

// Pixel X-coordinate of a handle, given its distance along the track.
// Used by pointer handlers to detect which handle is being dragged.
export function handleXPosition(
  distanceAtIndex: number,
  totalDistance: number,
  canvasWidth: number,
): number {
  const chartWidth = canvasWidth - PAD.left - PAD.right;
  return PAD.left + (distanceAtIndex / (totalDistance || 1)) * chartWidth;
}

// Nearest point index for a given canvas X coordinate (binary search on distances).
export function indexAtCanvasX(
  canvasX: number,
  canvasWidth: number,
  distances: number[],
  totalDistance: number,
): number {
  const chartWidth = canvasWidth - PAD.left - PAD.right;
  const clampedX   = Math.max(PAD.left, Math.min(canvasX, PAD.left + chartWidth));
  const ratio      = (clampedX - PAD.left) / chartWidth;
  const targetDist = ratio * totalDistance;
  let lo = 0, hi = distances.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (distances[mid] <= targetDist) lo = mid; else hi = mid - 1;
  }
  return lo;
}
