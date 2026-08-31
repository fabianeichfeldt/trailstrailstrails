export function formatDistanceMeters(distanceKm: number): string {
  return `${Math.round(distanceKm * 1000)} m`;
}
