export const locations = [
  { "name": "Berlin", "lat": 52.5200, "lng": 13.4050 },
  { "name": "Hamburg", "lat": 53.5511, "lng": 9.9937 },
  { "name": "Muenchen", "lat": 48.1351, "lng": 11.5820 },
  { "name": "Koeln", "lat": 50.9375, "lng": 6.9603 },
  { "name": "Stuttgart", "lat": 48.7758, "lng": 9.1829 },
  { "name": "Duesseldorf", "lat": 51.2277, "lng": 6.7735 },
  { "name": "Leipzig", "lat": 51.3397, "lng": 12.3731 },
  { "name": "Dortmund", "lat": 51.5136, "lng": 7.4653 },
  { "name": "Essen", "lat": 51.4556, "lng": 7.0116 },
  { "name": "Nuernberg", "lat": 49.4521, "lng": 11.0767 },
  { "name": "Augsburg", "lat": 48.3705, "lng": 10.8978 },
  { "name": "Regensburg", "lat": 49.0134, "lng": 12.1016 },
  { "name": "Ingolstadt", "lat": 48.7665, "lng": 11.4257 },
  { "name": "Karlsruhe", "lat": 49.0069, "lng": 8.4037 },
  { "name": "Mannheim", "lat": 49.4875, "lng": 8.4660 },
  { "name": "Freiburg", "lat": 47.9990, "lng": 7.8421 },
  { "name": "Heidelberg", "lat": 49.3988, "lng": 8.6724 },
  { "name": "Frankfurt", "lat": 50.1109, "lng": 8.6821 },
  { "name": "Wiesbaden", "lat": 50.0826, "lng": 8.2400 },
  { "name": "Kassel", "lat": 51.3127, "lng": 9.4797 },
  { "name": "Darmstadt", "lat": 49.8728, "lng": 8.6512 },
  { "name": "Offenbach", "lat": 50.0956, "lng": 8.7761 },
  { "name": "Saarbruecken", "lat": 49.2402, "lng": 6.9969 },
  { "name": "Neunkirchen", "lat": 49.3444, "lng": 7.1847 },
  { "name": "Homburg", "lat": 49.3227, "lng": 7.3385 },
  { "name": "Fraenkische-Schweiz", "lat": 49.8115714, "lng": 11.3140095 },
  { "name": "Oberpfalz", "lat": 49.565280, "lng": 11.90831 },
  { "name": "Allgaeu", "lat": 47.680687, "lng": 10.173268 },
  { "name": "Schwarzwald", "lat": 48.206870, "lng": 8.168263 },
  { "name": "Schwaebische-Alb", "lat": 48.295612, "lng": 9.360047 },
  { "name": "Taunus", "lat": 50.216099, "lng": 8.420206 },
  { "name": "Odenwald", "lat": 49.589749, "lng": 9.006898 },
  { "name": "Rhoen", "lat": 50.471402, "lng": 10.067911 },
  { "name": "Pfalz", "lat": 49.517976, "lng": 7.981093 },
];  

export async function getApproxLocation() {
  try {
    const res = await fetch('https://trailradar.org/geo');
    if (!res.ok) throw new Error('no geo data');
    const data = await res.json();
    if (data.lat && data.lon) {
      const lat = Math.round(data.lat * 10) / 10;
      const lon = Math.round(data.lon * 10) / 10;
      return [lat, lon];
    }
  } catch (err) {
    console.error('geo failed', err);
  }
  return null;
}