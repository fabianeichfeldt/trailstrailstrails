const trails = require('../../trail_analysis.json');

const api_key = process.env.ADD_TRAIL_ANON;
async function pushTrail(trail) {
  const response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/trail-details`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
    },
    body: JSON.stringify({ 
      trail_id: trail.id,
      rules: trail.analysis.trail_rules || [],
      status: trail.analysis.open_status || 'unknown',
      status_hint: trail.analysis.closure_reason || '',
      opening_hours: trail.analysis.opening_hours || '',
     }),
  });
  console.log(response.status, await response.text());
}

(async () => {
  for (const trail of trails) {
    await pushTrail(trail);
    console.log(`Trail: ${trail.name} pushed`);
  }
})();
