import * as ImageManipulator from 'expo-image-manipulator';
import { Image, Platform } from 'react-native';

// Same ceiling as apps/api/src/routes/collections.ts's
// MAIN_IMAGE_MAX_DIMENSION — a guest's locally-stored photo should end up
// the same size a logged-in user's server-stored one does.
const MAX_DIMENSION = 2000;

export interface ResizedPhoto {
  uri: string;
  webFile?: File;
}

// ImagePicker's `quality: 0.8` (see onPickPhoto in poke-lids/[id].tsx) only
// controls JPEG compression, not resolution — a full-sensor photo from a
// modern phone can still be 10MB+. Left unresized, that's what would sit in
// a guest's IndexedDB/OPFS quota (and, in phase 2, what would eventually
// need uploading) for every single photo.
//
// MUST be called AFTER photoExif.extractPhotoExif, never before: neither
// path here carries EXIF through (the canvas path has no EXIF concept at
// all; expo-image-manipulator doesn't preserve it either), matching why the
// server's own resizeForStorage in collections.ts also strips it — this is
// the client-side mirror of that same resize-drops-metadata fact, not a
// separate design choice.
export async function resizePhotoForStorage(photo: { uri: string; webFile?: File }): Promise<ResizedPhoto> {
  return Platform.OS === 'web' ? resizeOnWeb(photo) : resizeOnNative(photo.uri);
}

async function resizeOnWeb(photo: { uri: string; webFile?: File }): Promise<ResizedPhoto> {
  // Only present on web — see UploadPhotoInput's doc comment in api.ts for
  // why the native `uri` alone isn't enough to read pixel data from on web.
  if (!photo.webFile) return photo;

  const bitmap = await createImageBitmap(photo.webFile);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return photo;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  if (!blob) return photo;

  const file = new File([blob], photo.webFile.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  return { uri: URL.createObjectURL(file), webFile: file };
}

// `Image.getSize` (not ImageManipulator itself) is what determines the
// original orientation-aware dimensions: manipulateAsync's resize action
// sets width/height literally rather than fitting-within-bounds, so passing
// both without knowing which edge is already the long one would distort a
// portrait photo into MAX_DIMENSION×MAX_DIMENSION instead of scaling it
// down proportionally.
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

async function resizeOnNative(uri: string): Promise<ResizedPhoto> {
  const { width, height } = await getImageSize(uri);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: targetWidth, height: targetHeight } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri };
}
