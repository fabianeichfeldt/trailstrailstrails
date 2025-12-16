function createSchemaEntry(loc: Location): JsonLD {
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

export function generateJsonLD(locations: Location[]) {
  const script = document.createElement("script");
  script.setAttribute("type", "application/ld+json");
  const data: JsonLD[] =  [];

  locations.forEach(loc => data.push(createSchemaEntry(loc)));
  script.innerHTML = JSON.stringify(data);
  document.head.appendChild(script);
}
export class JsonLD {
  public constructor(location: Location, name: string) {
    this.name = name;
    this.geo = new JsonLDCoordinates(location);
  }
  "@context": string = "https://schema.org";
  "@type": string = "Place";
  "name": string = "name";
  "description": string = "";
  "geo": JsonLDCoordinates = new JsonLDCoordinates(new Location());
  "url": string = "";
}
class JsonLDCoordinates {
  public constructor(location: Location) {
    this.latitude = location.latitude;
    this.longitude = location.longitude;
  }
  readonly "@type": string = "GeoCoordinates";
  latitude: number = 0;
  longitude: number = 0;
}
export class Location {
  name: string = "";
  id: string = "";
  latitude: number = 0;
  longitude: number = 0;
}