export type ImbaColor = 'green' | 'blue' | 'red' | 'black' | 'double-black';
export type TrailDirection = 'cw' | 'ccw' | 'one-way-down' | 'one-way-up' | 'both';

export interface ElevationPoint {
  dist: number;  // km from start
  alt: number;   // meters above sea level
}

export interface MtbTrail {
  id: string;
  spotId: string;
  name: string;
  difficulty: ImbaColor;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  direction: TrailDirection;
  gpxPoints: [number, number, number][];  // [lat, lng, alt]
  elevationProfile: ElevationPoint[];
  gpx_url?: string;  // URL to download original GPX file
}

/** One segment of a tour: either a trail (downhill, IMBA colored) or a transfer (uphill/neutral) */
export interface TourSegment {
  type: 'trail' | 'transfer';
  trailId?: string;       // set when type === 'trail'
  difficulty?: ImbaColor; // set when type === 'trail'
  name?: string;
  gpxPoints: [number, number, number][];
}

export interface MtbTour {
  id: string;
  spotId: string;
  name: string;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  direction: 'cw' | 'ccw';
  duration_minutes: number;
  trailCount: number;
  segments: TourSegment[];
  /** Full tour route — either from a real GPX or stitched from segments */
  gpxPoints: [number, number, number][];
  elevationProfile: ElevationPoint[];
  /** true = gpxPoints came from a real recorded GPX; false = auto-stitched */
  hasFullGpx: boolean;
  gpx_url?: string;  // URL to download original GPX file
}

export interface SpotMtbData {
  spotId: string;
  tours: MtbTour[];
  trails: MtbTrail[];
}
