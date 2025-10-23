const anon = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ";

export async function getParks() {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/bike-parks", {
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
