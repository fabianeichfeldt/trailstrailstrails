export async function share(trailID: string) {
  await fetch(`https://trailradar.org/api/share?id=${encodeURIComponent(trailID)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}