import {BaseTrail} from "../types/Trail";

export async function share(trailID: string) {
  await fetch(`https://trailradar.org/api/share?id=${trailID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}