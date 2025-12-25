import {BaseTrail} from "../types/Trail";

export async function share(trail: BaseTrail) {
  await fetch(`https://trailradar.org/api/share?id=${trail.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}