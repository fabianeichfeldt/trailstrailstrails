import {anon} from "../anon";
import {BaseTrail, BikePark, DirtPark, isBikePark, isDirtPark, SingleTrail, Trail} from "../types/Trail";
import {TrailDetails} from "../types/TrailDetails";
import {IAuthService} from "../auth/auth_service";
import {SpotMtbData, MtbTrail, MtbTour, ElevationPoint} from "../types/MtbTypes";

function fallbackDetails(trail: Trail): TrailDetails {
  return new TrailDetails(trail.id);
}

const DETAILS_TTL = 5 * 60 * 1000;
const detailsCache = new Map<string, { data: TrailDetails; ts: number }>();

export async function getTrails(): Promise<SingleTrail[]> {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trails?select=*", {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return (json as Array<Trail>).map(i => {
    return {
      ...i,
      type: "trail",
    }
  });
}

export async function getFavoriteTrails(userID: string): Promise<BaseTrail[]> {
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_favorites?select=*,trails(*)&user_id=eq.${userID}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });
  const trailjson = await trailResponse.json();
  return (trailjson as { trails: BaseTrail }[]).map(i => i.trails);
}

export async function getTrailsByUserId(userId: string): Promise<BaseTrail[]> {
  const trailResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trails?select=*&creator_id=eq.${userId}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  const bikeParkResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/parks?creator_id=eq.${userId}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  const dirtParkResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/dirt_parks?creator_id=eq.${userId}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  const [dirtParks, trails, bikeParks] = await Promise.all([dirtParkResponse, trailResponse, bikeParkResponse]);
  const dirtjson = await dirtParks.json();
  const trailjson = await trails.json();
  const parksjson = await bikeParks.json();
  const dirt = (dirtjson as Array<DirtPark>).map(i => {
    return {
      ...i,
      type: "dirtpark",
    }
  });
  const t = (trailjson as Array<SingleTrail>).map(i => {
    return {
      ...i,
      type: "trail",
    }
  });

  const b = (parksjson as Array<BikePark>).map(i => {
    return {
      ...i,
      type: "bikepark",
    }
  });

  return t.concat(dirt).concat(b);
}

export interface PhotoResponse {
  url: string;
  created_at: string;
  trailName: string;
  trailID: string;
}
export async function getPhotosByUserId(userId: string): Promise<PhotoResponse[]> {
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_photos?select=*,trails(name)&creator=eq.${userId}`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });
  const trailjson = await trailResponse.json();
  return (trailjson as { url: string, created_at: string, trail_id: string, trails: { name: string } }[]).map(i => {
    return { url: i.url, created_at: i.created_at, trailName: i.trails.name, trailID: i.trail_id }
  });
}

export async function getLatestPhotos(num: number = 7): Promise<PhotoResponse[]> {
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_photos?select=*,trails(name)&order=created_at.desc`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Range-Unit": "items",
      "Range": `0-${num - 1}`,
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });
  const trailjson = await trailResponse.json();
  return (trailjson as { url: string, created_at: string, trail_id: string, trails: { name: string } }[]).map(i => {
    return { url: i.url, created_at: i.created_at, trailName: i.trails.name, trailID: i.trail_id }
  });
}

export async function getTrailDetails(trail: Trail): Promise<TrailDetails> {
  const cached = detailsCache.get(trail.id);
  if (cached && Date.now() - cached.ts < DETAILS_TTL) return cached.data;

  let response;
  if (isDirtPark(trail)) {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/dirt-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  } else if (isBikePark(trail)) {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  } else {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/trail-details?trail=${trail.id}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }

  if (!response.ok)
    return fallbackDetails(trail);

  const json = await response.json();
  const data = json.data ?? fallbackDetails(trail);
  detailsCache.set(trail.id, { data, ts: Date.now() });
  return data;
}

export function createCustomIcon(trail: Trail) {
  let category = 'unverified';
  if (trail.approved) {
    category = 'verified';
    if (isDirtPark(trail))
      category = 'dirtpark';
    else if (isBikePark(trail))
      category = 'bikepark';
  }

  // TODO: replace `true` with `trail.spotcheck` (or similar) once the field exists
  const hasBadge = false;

  return L.divIcon({
    html: `<div class="marker-wrapper marker-${category}${hasBadge ? ' marker-has-badge' : ''}">
      <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="marker-img" />
      ${hasBadge ? '<span class="marker-badge">✓</span>' : ''}
    </div>`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    className: '',
  });
}

export async function likeTrail(trailID: string, authService: IAuthService) {
  const user = await authService.getUser();
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_favorites`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${user.accessToken}`,
      "apikey": `${anon}`,
    },
    body: JSON.stringify({
      user_id: user.id,
      trail_id: trailID
    })
  });
}

export async function dislikeTrail(trailID: string, authService: IAuthService) {
  const user = await authService.getUser();
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_favorites?trail_id=eq.${trailID}&user_id=eq.${user.id}`, {
    method: "DELETE",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${user.accessToken}`,
      "apikey": `${anon}`,
      Prefer: "return=representation"
    }
  });
}

// ── GPX Data fetching ─────────────────────────────────────────────────────────

function toElevationProfile(points: [number, number, number][]): ElevationPoint[] {
  if (points.length === 0) return [];
  let cumulativeDist = 0;
  return points.map((p, i) => {
    if (i > 0) {
      const dlat = (p[0] - points[i - 1][0]) * 111000;
      const dlng = (p[1] - points[i - 1][1]) * 111000 * Math.cos(p[0] * Math.PI / 180);
      cumulativeDist += Math.hypot(dlat, dlng) / 1000;
    }
    return { dist: Math.round(cumulativeDist * 10) / 10, alt: p[2] };
  });
}

function calcElevationGain(points: [number, number, number][]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const dAlt = points[i][2] - points[i - 1][2];
    if (dAlt > 0) gain += dAlt;
  }
  return Math.round(gain);
}

function calcElevationLoss(points: [number, number, number][]): number {
  let loss = 0;
  for (let i = 1; i < points.length; i++) {
    const dAlt = points[i][2] - points[i - 1][2];
    if (dAlt < 0) loss += -dAlt;
  }
  return Math.round(loss);
}

interface RawGpxTrail {
  id: string;
  spot_id: string;
  name: string;
  difficulty: string;
  direction: string;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  gpx_points: [number, number, number][];
  gpx_url?: string;
}

interface RawGpxTour {
  id: string;
  spot_id: string;
  name: string;
  direction: 'cw' | 'ccw';
  duration_minutes: number;
  trail_names?: string[] | null;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  gpx_points: [number, number, number][];
  gpx_url?: string;
}

export async function getSpotGpxData(spotId: string): Promise<SpotMtbData | null> {
  try {
    // Fetch trails and tours in parallel
    const [trailsRes, toursRes] = await Promise.all([
      fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/spot_gpx_trails?select=*&spot_id=eq.${spotId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anon}`,
          "apikey": `${anon}`,
        },
      }),
      fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/spot_gpx_tours?select=*&spot_id=eq.${spotId}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anon}`,
          "apikey": `${anon}`,
        },
      }),
    ]);

    if (!trailsRes.ok || !toursRes.ok) {
      return null;
    }

    const rawTrails = (await trailsRes.json()) as RawGpxTrail[];
    const rawTours = (await toursRes.json()) as RawGpxTour[];

    // Transform trails
    const trails: MtbTrail[] = rawTrails.map((rt, i) => ({
      id: rt.id || `${spotId}-trail-${i}`,
      spotId: rt.spot_id,
      name: rt.name,
      difficulty: rt.difficulty as any,
      direction: rt.direction as any,
      distance_km: rt.distance_km,
      elevation_gain: rt.elevation_gain,
      elevation_loss: rt.elevation_loss,
      gpxPoints: rt.gpx_points,
      elevationProfile: toElevationProfile(rt.gpx_points),
      gpx_url: rt.gpx_url,
    }));

    // Transform tours
    const tours: MtbTour[] = rawTours.map((rt, i) => ({
      id: rt.id || `${spotId}-tour-${i}`,
      spotId: rt.spot_id,
      name: rt.name,
      direction: rt.direction,
      duration_minutes: rt.duration_minutes,
      distance_km: rt.distance_km,
      elevation_gain: rt.elevation_gain,
      elevation_loss: rt.elevation_loss,
      trailCount: (rt.trail_names?.length ?? 0),
      segments: [], // Will be populated below
      gpxPoints: rt.gpx_points,
      elevationProfile: toElevationProfile(rt.gpx_points),
      hasFullGpx: true, // These are real GPX files
      gpx_url: rt.gpx_url,
    }));

    // Reconstruct segments from trail_names
    const trailsByName = new Map(trails.map(t => [t.name, t]));
    for (let i = 0; i < tours.length; i++) {
      const tour = tours[i];
      const rawTour = rawTours[i];
      if (!tour.gpxPoints || tour.gpxPoints.length === 0) continue;

      const segments = [];

      // Create segment for each detected trail
      if (rawTour.trail_names && rawTour.trail_names.length > 0) {
        for (const trailName of rawTour.trail_names) {
          const trail = trailsByName.get(trailName);
          if (trail) {
            segments.push({
              type: 'trail' as const,
              trailId: trail.id,
              difficulty: trail.difficulty,
              name: trail.name,
              gpxPoints: trail.gpxPoints,
            });
          }
        }
      }

      tour.segments = segments;
    }

    return { spotId, trails, tours };
  } catch (err) {
    console.error("Error fetching spot GPX data:", err);
    return null;
  }
}