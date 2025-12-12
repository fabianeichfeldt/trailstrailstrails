import { anon } from "../anon.js";

export async function getParks() {
  const response = await fetch("https://trailradar.org/api/bike-parks", {
    method: "GET",
    cache: "force-cache",
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
