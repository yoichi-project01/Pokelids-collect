// Meter precision below 1km, one decimal of km above it. Extracted from
// poke-lids/[id].tsx's own formatPhotoDistance (guest photo distance
// display, 7-9) so PhotoPreviewModal's location-mismatch warning (the
// photo's PhotoPreviewModal-time distance) renders numbers the same way
// rather than inventing its own rounding rules. Deliberately just the
// "1.2km"/"850m" fragment, no surrounding sentence — each caller's own
// wording (e.g. "現地から850m", "「西宮市」から1.2km離れた場所で…") differs
// enough that baking a fixed sentence in here would fight both of them.
export function formatDistanceMeters(distanceMeters: number): string {
  return distanceMeters < 1000 ? `${Math.round(distanceMeters)}m` : `${(distanceMeters / 1000).toFixed(1)}km`;
}
