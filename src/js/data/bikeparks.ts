import { anon } from "../anon";
import { BikePark } from "../types/Trail";

export async function getParks(): Promise<BikePark[]> {
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
