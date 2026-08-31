export function formatDistance(distanceKm: number): string {
  if (distanceKm < 10) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters.toLocaleString('de-DE')}m`;
  }
  return `${distanceKm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}km`;
}
