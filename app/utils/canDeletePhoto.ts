export interface PhotoPermissionContext {
  userId: string
  isAdmin: boolean
  photosCanModerate: boolean
}

// The prerendered/baked photo payload (getTrailById()/getTrailBySlug()) only
// selects id/url and carries no `creator` on first paint — the delete
// button must stay hidden until live data with `creator` has loaded, not
// show for everyone because undefined === undefined (or '' === '' for a
// logged-out viewer with an empty userId).
export function canDeletePhoto(photo: { creator?: string }, ctx: PhotoPermissionContext): boolean {
  return !!photo.creator && (photo.creator === ctx.userId || ctx.isAdmin || ctx.photosCanModerate)
}
