const trails = require('../../ /bikeparks_analysis.json');

const api_key = process.env.ADD_TRAIL_ANON;
async function pushTrail(trail) {
  const response = await fetch(`https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks-details`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${api_key}`,
    },
    body: JSON.stringify({ 
      id: trail.id,
      rules: (trail.analysis.trail_rules.length > 0) ? trail.analysis.trail_rules : [trail.analysis.general_description || ''],
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
