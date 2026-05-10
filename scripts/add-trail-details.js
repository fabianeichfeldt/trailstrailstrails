const trails = require('../../trail-scraper/trail_analysis.json');

const SUPABASE_URL = 'https://ixafegmxkadbzhxmepsd.supabase.co';
const service_role_key = process.env.SUPABASE_SERVICE_KEY;

async function upsertTrail(trail) {
  const { name: _name, confidence: _confidence, ...fields } = trail;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/trail_details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': service_role_key,
      'Authorization': `Bearer ${service_role_key}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(fields),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[${trail.trail_id}] ${trail.name} — ${response.status}: ${text}`);
  } else {
    console.log(`[${trail.trail_id}] ${trail.name} — ok`);
  }
}

(async () => {
  for (const trail of trails) {
    await upsertTrail(trail);
  }
})();
