import { anon } from "../anon.js";
export async function getTrails() {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/add-trail", {
    method: "GET",
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

export async function getTrailDetails(id, type) {
  let response = null;
  if(type === 'dirtpark') {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/dirt-parks-details?id=${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }
  else if(type === 'bikepark') {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks-details?id=${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }
  else {
    response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/trail-details?trail=${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anon}`,
      },
    });
  }

  if (!response.ok) {
    return {};
  }

  const json = await response.json();
  return json.data[0];
}

export function createCustomIcon(approved, type) {
  let category = 'unverified';
  if (approved) {
    category = 'verified';
    if(type === 'dirtpark')
      category = 'dirtpark';
    else if(type === 'bikepark')
      category = 'bikepark';
  }
  
  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: `marker-${category}`,
  });

  return icon;
}

