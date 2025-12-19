import { anon } from "../anon";
import { DirtPark } from "../types/Trail";

export async function getDirtParks() :Promise<DirtPark[]> {
  const response = await fetch("https://trailradar.org/api/dirt-parks", {
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
  return (json.data as Array<DirtPark>).map(i => {
    return {
      ...i,
      type: "dirtpark",
    }});
}
