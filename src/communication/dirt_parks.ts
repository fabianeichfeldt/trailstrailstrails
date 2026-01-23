import { anon } from "../anon";
import { DirtPark } from "../types/Trail";

export async function getDirtParks() :Promise<DirtPark[]> {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/dirt_parks?select=*", {
    method: "GET",
    cache: "force-cache",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anon}`,
      "apikey": `${anon}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  return (json as Array<DirtPark>).map(i => {
    return {
      ...i,
      type: "dirtpark",
    }});
}
