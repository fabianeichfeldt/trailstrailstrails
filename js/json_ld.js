export function generateJsonLD(locations, openedSpecificTrail) {
  const script = document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  const data =  [];

  if (openedSpecificTrail)
    data.push(createSchemaEntry(locations.find(loc => loc.id === openedSpecificTrail)));
  else
    locations.forEach(loc => data.push(createSchemaEntry(loc)));
  script.innerHTML = JSON.stringify(data);
  document.head.appendChild(script);
}

function createSchemaEntry(loc) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "name": loc.name,
    "description": "",
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": loc.latitude,
      "longitude": loc.longitude
    },
    "url": `https://trailradar.org/trails/${loc.id}`
  };
}
