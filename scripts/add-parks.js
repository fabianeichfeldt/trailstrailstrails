import { bikeparks } from '../js/data/bikeparks.ts';

const api_key = process.env.ADD_TRAIL_ANON;
async function pushpark(park) {
  const response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
    },
    body: JSON.stringify({ 
      name: park.name,
      url: park.url,
      instagram: park.instagram || '',
      creator: 'webmaster@trailradar.org',
      latitude: park.coords[0],
      longitude: park.coords[1],
     }),
  });
  console.log(response.status);
}

(async () => {
  for (const park of bikeparks) {
    await pushpark(park);
    console.log(`Trail: ${park.name} pushed`);
  }
})();
