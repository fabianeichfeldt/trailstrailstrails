import { ElevationPoint, ImbaColor, MtbTour, MtbTrail, TourSegment } from '../../types/MtbTypes';

export type AnyItem = MtbTour | MtbTrail;

export const IMBA: Record<ImbaColor, { hex: string; label: string }> = {
  'green':        { hex: '#2e7d32', label: 'Grün · Einsteiger'    },
  'blue':         { hex: '#1565c0', label: 'Blau · Fortgeschritte' },
  'red':          { hex: '#c62828', label: 'Rot · Schwierig'       },
  'black':        { hex: '#111111', label: 'Schwarz · Experte'     },
  'double-black': { hex: '#000000', label: '⚫⚫ Extrem'            },
};

// Chart geometry — shared by elevationSVG (rendering) and bindElevationHover (hit-testing)
const W = 300, H = 88;
const PL = 30, PR = 6, PT = 6, PB = 18;
const cW = W - PL - PR;   // 264
const cH = H - PT - PB;   // 64

export function elevationSVG(profile: ElevationPoint[], item: AnyItem, segments?: TourSegment[]): string {
  if (profile.length < 2) return '';

  const alts   = profile.map(p => p.alt);
  const minA   = Math.min(...alts), maxA = Math.max(...alts);
  const rangeA = maxA - minA || 1;
  const maxD   = profile[profile.length - 1].dist || 1;

  const px = (d: number) => PL + (d / maxD) * cW;
  const py = (a: number) => PT + cH - ((a - minA) / rangeA) * cH;

  const yLabels = [minA, minA + rangeA / 2, maxA].map(a =>
    `<text x="${PL - 3}" y="${py(a) + 3.5}" text-anchor="end" font-size="8" fill="#999">${Math.round(a)}</text>`
  ).join('');
  const xLabels = [0, maxD / 2, maxD].map(d =>
    `<text x="${px(d).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="8" fill="#999">${d.toFixed(1)} km</text>`
  ).join('');

  let profileLines = '';
  let fillPath     = '';

  if (segments && segments.length) {
    let ptIdx = 0;
    for (const seg of segments) {
      const n    = seg.gpxPoints.length;
      const pts  = profile.slice(ptIdx, ptIdx + n);
      ptIdx += n;
      if (pts.length < 2) continue;

      const color  = seg.type === 'trail' ? IMBA[seg.difficulty!].hex : '#aaa';
      const width  = seg.type === 'trail' ? '2.2' : '1.5';
      const points = pts.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
      profileLines += `<polyline points="${points}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linejoin="round" opacity="${seg.type === 'trail' ? 1 : 0.6}"/>`;
    }
    const allPts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
    const fD = `M ${allPts.replace(/ /g, ' L ')} L${px(maxD).toFixed(1)},${(PT + cH).toFixed(1)} L${px(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;
    fillPath = `<path d="${fD}" fill="rgba(0,0,0,0.04)"/>`;
  } else {
    const diff   = 'difficulty' in item ? (item as MtbTrail).difficulty : null;
    const color  = diff ? IMBA[diff].hex : '#666';
    const gradId = `eg-${diff ?? 'tour'}`;
    const linePts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
    const pathD   = `M ${linePts.replace(/ /g, ' L ')}`;
    const fD      = `${pathD} L${px(maxD).toFixed(1)},${(PT + cH).toFixed(1)} L${px(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;
    fillPath     = `<defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.03"/>
      </linearGradient>
    </defs>
    <path d="${fD}" fill="url(#${gradId})"/>`;
    profileLines = `<polyline points="${linePts}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="cursor:crosshair;overflow:visible">
    <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + cH}" stroke="#eee" stroke-width="1"/>
    <line x1="${PL}" y1="${PT + cH}" x2="${PL + cW}" y2="${PT + cH}" stroke="#eee" stroke-width="1"/>
    ${fillPath}
    ${profileLines}
    ${yLabels}
    ${xLabels}
    <g class="elev-scrubber" visibility="hidden" pointer-events="none">
      <line class="elev-scrub-line"
        x1="0" y1="${PT}" x2="0" y2="${PT + cH}"
        stroke="rgba(80,80,80,0.55)" stroke-width="1.5"/>
      <circle class="elev-scrub-dot" cx="0" cy="0" r="4.5" fill="white" stroke-width="2.5"/>
      <text class="elev-scrub-txt" x="0" y="0"
        text-anchor="middle" font-size="9" font-weight="700" fill="#333"
        style="text-shadow:0 0 3px #fff,0 0 3px #fff"/>
    </g>
  </svg>`;
}

export function bindElevationHover(
  svgEl: SVGSVGElement,
  item: AnyItem,
  onHover: (latlng: [number, number], color: string) => void,
  onLeave: () => void,
): void {
  if (item.gpxPoints.length < 2) return;

  const profile = item.elevationProfile;
  const maxDist = profile[profile.length - 1]?.dist || 1;
  const alts    = profile.map(p => p.alt);
  const minA    = Math.min(...alts);
  const rangeA  = Math.max(...alts) - minA || 1;
  const color   = 'difficulty' in item ? IMBA[(item as MtbTrail).difficulty].hex : '#444';

  const scrubber = svgEl.querySelector('.elev-scrubber') as SVGGElement;
  const scrubLine = svgEl.querySelector('.elev-scrub-line') as SVGLineElement;
  const scrubDot  = svgEl.querySelector('.elev-scrub-dot')  as SVGCircleElement;
  const scrubTxt  = svgEl.querySelector('.elev-scrub-txt')  as SVGTextElement;

  const closestIdx = (dist: number): number => {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < profile.length; i++) {
      const d = Math.abs(profile[i].dist - dist);
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  };

  const onMove = (clientX: number) => {
    const rect   = svgEl.getBoundingClientRect();
    const scaleX = W / rect.width;                        // viewBox→rendered
    const svgX   = (clientX - rect.left) * scaleX;
    const chartX = Math.max(0, Math.min(svgX - PL, cW));
    const dist   = (chartX / cW) * maxDist;
    const idx    = closestIdx(dist);
    const pt     = profile[idx];
    const gpx    = item.gpxPoints[idx];

    const x = PL + (pt.dist / maxDist) * cW;
    const y = PT + cH - ((pt.alt - minA) / rangeA) * cH;

    scrubLine.setAttribute('x1', String(x));
    scrubLine.setAttribute('x2', String(x));
    scrubDot.setAttribute('cx',  String(x));
    scrubDot.setAttribute('cy',  String(y));
    scrubDot.setAttribute('stroke', color);

    const labelY = y > PT + cH / 2 ? y - 7 : y + 14;
    scrubTxt.setAttribute('x', String(Math.max(18, Math.min(x, 282))));
    scrubTxt.setAttribute('y', String(labelY));
    scrubTxt.textContent = `${Math.round(pt.alt)} m`;

    scrubber.removeAttribute('visibility');
    onHover([gpx[0], gpx[1]], color);
  };

  const handleLeave = () => {
    scrubber.setAttribute('visibility', 'hidden');
    onLeave();
  };

  svgEl.addEventListener('mousemove', e => onMove(e.clientX));
  svgEl.addEventListener('mouseleave', handleLeave);
  svgEl.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0].clientX); }, { passive: false });
  svgEl.addEventListener('touchend', handleLeave);
}
