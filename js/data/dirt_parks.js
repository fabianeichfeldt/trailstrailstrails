import { anon } from "../anon.js";

export async function getDirtParks() {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/dirt-parks", {
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

