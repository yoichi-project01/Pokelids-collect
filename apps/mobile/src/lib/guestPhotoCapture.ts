import { haversineDistanceMeters } from '@pokelids/shared';
import { extractPhotoExif } from './photoExif';
import { getAllGuestPhotos, saveGuestPhoto, type GuestPhotoWithUri } from './guestPhotoStorage';
import { resizePhotoForStorage } from './imageResize';
import { ensurePersistentStorage } from './storagePersistence';

export interface PickedPhoto {
  uri: string;
  webFile?: File;
}

export interface PokeLidCoordinates {
  latitude: number;
  longitude: number;
}

// Orchestrates the full guest-photo pipeline in a fixed order: EXIF is read
// from the ORIGINAL picked photo *before* it's resized. Reversing this order
// is a real, easy-to-reintroduce bug — resizing (imageResize.ts) strips
// metadata including GPS, the same reason the server's own resizeForStorage
// (collections.ts) runs after its EXIF extraction — so both steps here are
// deliberately called on the same untouched `photo` input, not chained
// output-to-input, and in this fixed sequence. See
// guestPhotoCapture.test.ts for the ordering test.
export async function captureGuestPhoto(
  pokeLidId: string,
  photo: PickedPhoto,
  lidCoords: PokeLidCoordinates,
): Promise<GuestPhotoWithUri> {
  const exif = await extractPhotoExif(photo);
  const resized = await resizePhotoForStorage(photo);

  const distanceMeters =
    exif.latitude !== null && exif.longitude !== null
      ? haversineDistanceMeters(exif.latitude, exif.longitude, lidCoords.latitude, lidCoords.longitude)
      : null;

  // Checked before saving, not after — "is this the guest's first photo
  // ever" has to mean "before this one," or it would never be true (this
  // save always makes the post-save count >= 1).
  const isFirstPhotoEver = (await getAllGuestPhotos()).length === 0;
  const saved = await saveGuestPhoto(pokeLidId, resized, distanceMeters, exif.capturedAt);

  // 7-10: request storage persistence right when there's first something
  // worth protecting — not at app launch, where there'd be nothing to lose
  // yet and the request would just be noise. Fire-and-forget: best-effort,
  // must not delay returning the saved photo to the caller.
  if (isFirstPhotoEver) void ensurePersistentStorage();

  return saved;
}
