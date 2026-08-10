import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';
import exifr from 'exifr';

export interface PhotoExifResult {
  latitude: number | null;
  longitude: number | null;
  capturedAt: string | null;
}

// Mirrors apps/api/src/routes/collections.ts's extractPhotoExif exactly —
// same two exifr calls, same fallback shape — so a guest's client-side
// preview and the server's eventual (phase 2) re-derivation agree.
//
// Deliberately does NOT use ImagePicker's own `exif: true` option: per
// Expo's docs, that option is iOS/Android only (no web), and on iOS
// specifically "the exif data does not include GPS tags in the camera
// case" — exactly the capture path this feature cares most about. Reading
// the raw file bytes with exifr sidesteps that gap entirely, same as the
// server already does for uploaded files (7-9).
//
// Must be called on the ORIGINAL picked photo, before any resize — see
// imageResize.ts's doc comment for why resizing strips this metadata.
export async function extractPhotoExif(photo: { uri: string; webFile?: File }): Promise<PhotoExifResult> {
  try {
    // exifr accepts a browser File directly (it slices out just the EXIF
    // segment itself rather than needing the whole file in memory); on
    // native there's no Blob-like handle for a file:// uri, so this reads
    // the file's bytes first instead.
    const input = Platform.OS === 'web' ? photo.webFile : await new ExpoFile(photo.uri).bytes();
    if (!input) return { latitude: null, longitude: null, capturedAt: null };

    const [gps, dateTimeOriginal] = await Promise.all([
      exifr.gps(input),
      exifr.parse(input, ['DateTimeOriginal']),
    ]);
    return {
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      capturedAt: dateTimeOriginal?.DateTimeOriginal
        ? new Date(dateTimeOriginal.DateTimeOriginal).toISOString()
        : null,
    };
  } catch {
    return { latitude: null, longitude: null, capturedAt: null };
  }
}
