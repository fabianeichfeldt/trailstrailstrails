import { anon } from "../anon";
import { BikePark } from "../types/Trail";

export async function getParks(): Promise<BikePark[]> {
  const response = await fetch("https://ixafegmxkadbzhxmepsd.supabase.co/rest/v1/parks?select=*", {
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
  return (json as Array<BikePark>).map(i => {
    return {
      ...i,
      type: "bikepark",
    }});
}
