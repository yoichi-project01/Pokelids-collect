import { haversineDistanceMeters } from '@pokelids/shared';
import { extractPhotoExif } from './photoExif';
import { getAllGuestPhotos, saveGuestPhoto, type GuestPhotoWithUri } from './guestPhotoStorage';
import { ensurePersistentStorage } from './storagePersistence';

export interface PickedPhoto {
  uri: string;
  webFile?: File;
}

export interface PokeLidCoordinates {
  latitude: number;
  longitude: number;
}

// Deliberately does NOT resize before storing (an earlier version of this
// function did, via imageResize.ts, now deleted). That saved local storage
// space, but it also permanently threw away the photo's GPS EXIF — canvas
// (web) and expo-image-manipulator (native) both strip all metadata on
// resize, no way around it on either platform. That was fine as long as a
// guest's photo only ever needed to show a *distance preview* (computed
// right here, from the untouched original, same as below) — but 7-9 phase 2
// syncs this same stored file to the server later, where it needs to be
// re-examined for its *own* EXIF to authoritatively confirm a medal. A guest
// photo resized-and-stripped at capture time can never produce anything but
// SILVER after sync, no matter how good its original GPS was — this was
// caught by an actual GOLD-expected/SILVER-observed mismatch in production
// verification, not found by inspection. Storing the original instead keeps
// the server's medal determination (collections.ts's processAndStorePhoto)
// working from real data, the same as it already does for a logged-in
// user's immediate upload — which never resized client-side either, only
// server-side, for exactly this reason.
export async function captureGuestPhoto(
  pokeLidId: string,
  photo: PickedPhoto,
  lidCoords: PokeLidCoordinates,
): Promise<GuestPhotoWithUri> {
  const exif = await extractPhotoExif(photo);

  const distanceMeters =
    exif.latitude !== null && exif.longitude !== null
      ? haversineDistanceMeters(exif.latitude, exif.longitude, lidCoords.latitude, lidCoords.longitude)
      : null;

  // Checked before saving, not after — "is this the guest's first photo
  // ever" has to mean "before this one," or it would never be true (this
  // save always makes the post-save count >= 1).
  const isFirstPhotoEver = (await getAllGuestPhotos()).length === 0;
  const saved = await saveGuestPhoto(pokeLidId, photo, distanceMeters, exif.capturedAt);

  // 7-10: request storage persistence right when there's first something
  // worth protecting — not at app launch, where there'd be nothing to lose
  // yet and the request would just be noise. Fire-and-forget: best-effort,
  // must not delay returning the saved photo to the caller.
  if (isFirstPhotoEver) void ensurePersistentStorage();

  return saved;
}
