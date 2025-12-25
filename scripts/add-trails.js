import { trails } from '../js/communication/trails.ts';

const api_key = process.env.ADD_TRAIL_ANON;
async function pushTrail(trail) {
  const response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/add-trail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
    },
    body: JSON.stringify({ 
      name: trail.name,
      url: trail.url,
      instagram: trail.instagram || '',
      creator: 'webmaster@trailradar.org',
      latitude: trail.coords[0],
      longitude: trail.coords[1],
     }),
  });
  console.log(response.status);
}

(async () => {
  for (const trail of trails) {
    await pushTrail(trail);
    console.log(`Trail: ${trail.name} pushed`);
  }
})();
