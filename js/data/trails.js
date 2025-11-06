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
  
  const size = iconSizeByDevice();
  const scale = size[0] / 25;

  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
   iconSize: size,
    iconAnchor: [12 * scale, 41 * scale],
    popupAnchor: [1 * scale, -34 * scale],
    shadowSize: [41 * scale, 41 * scale],
    className: `marker-${category}`,
  });

  return icon;
}

function iconSizeByDevice(dpr = window.devicePixelRatio) {
  if (dpr >= 3)  return [40, 66];   // very hi-res (iPhones Pro etc.)
  if (dpr >= 2)  return [34, 56];   // normal 2x phones
  return [25, 41];                  // desktop / low dpi
}

