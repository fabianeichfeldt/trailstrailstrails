import {anon} from "../anon";
import {BaseTrail, BikePark, DirtPark, isBikePark, isDirtPark, SingleTrail, Trail} from "../types/Trail";
import {TrailDetails} from "../types/TrailDetails";

export async function getTrails(): Promise<SingleTrail[]> {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trails?select=*", {
    method: "GET",
    cache: "force-cache",
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

export async function getTrailsByUserId(userId: string): Promise<BaseTrail[]> {
  const trailResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trails?select=*&creator_id=eq.${userId}`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  const bikeParkResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/parks?creator_id=eq.${userId}`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  const dirtParkResponse = fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/dirt_parks?creator_id=eq.${userId}`, {
    method: "GET",
    cache: "force-cache",
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
  trail_name: string;
}
export async function getPhotosByUserId(userId: string): Promise<PhotoResponse[]> {
  const trailResponse = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/trail_photos?select=*,trails(name)&creator=eq.${userId}`, {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });
  const trailjson = await trailResponse.json();
  return (trailjson as { url: string, created_at: string, trails: { name: string } }[]).map(i => {
    return { url: i.url, created_at: i.created_at, trail_name: i.trails.name }
  });
}

export async function getTrailDetails(trail: Trail): Promise<TrailDetails> {
  let response;
  if (isDirtPark(trail)) {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/dirt-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "force-cache",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  } else if (isBikePark(trail)) {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "force-cache",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  } else {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/trail-details?trail=${trail.id}`, {
      method: "GET",
      cache: "force-cache",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }

  if (!response.ok)
    throw new Error(`Trails ${trail.type} failed with status ${response.status}`);

  const json = await response.json();
  return json.data;
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

  return {
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    className: `marker-${category}`,
  };
}

