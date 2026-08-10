import { haversineDistanceMeters } from '@pokelids/shared';
import { extractPhotoExif } from './photoExif';
import { saveGuestPhoto, type GuestPhotoWithUri } from './guestPhotoStorage';
import { resizePhotoForStorage } from './imageResize';

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

  return saveGuestPhoto(pokeLidId, resized, distanceMeters, exif.capturedAt);
}
