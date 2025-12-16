import { anon } from "../anon";
import {isBikePark, isDirtPark, SingleTrail, Trail} from "../types/Trail";
import {TrailDetails} from "../types/TrailDetails";

export async function getTrails(): Promise<SingleTrail[]>  {
  const response = await fetch("https://trailradar.org/api/add-trail", {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return json.data;
}

export async function getTrailDetails(trail: Trail): Promise<TrailDetails> {
  let response = null;
  if(isDirtPark(trail)) {
    response = await fetch(`https://trailradar.org/api/dirt-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "force-cache",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }
  else if(isBikePark(trail)) {
    response = await fetch(`https://trailradar.org/api/bike-parks-details?id=${trail.id}`, {
      method: "GET",
      cache: "force-cache",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }
  else {
    response = await fetch(`https://trailradar.org/api/trail-details?trail=${trail.id}`, {
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
    if(isDirtPark(trail))
      category = 'dirtpark';
    else if(isBikePark(trail))
      category = 'bikepark';
  }
  
  return {
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    className: `marker-${category}`,
  };
}

