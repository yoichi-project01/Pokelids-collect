import { describe, expect, it, vi } from 'vitest';

vi.mock('./photoExif', () => ({
  extractPhotoExif: vi.fn(async (_photo: { uri: string }) => ({
    latitude: 35.0,
    longitude: 139.0,
    capturedAt: '2026-01-01T00:00:00.000Z',
  })),
}));

vi.mock('./imageResize', () => ({
  resizePhotoForStorage: vi.fn(async (_photo: { uri: string }) => ({ uri: 'resized-uri' })),
}));

vi.mock('./guestPhotoStorage', () => ({
  saveGuestPhoto: vi.fn(
    async (
      pokeLidId: string,
      photo: { uri: string },
      distanceMeters: number | null,
      capturedAt: string | null,
    ) => ({
      id: 'p1',
      pokeLidId,
      distanceMeters,
      capturedAt,
      savedAt: '2026-01-01T00:00:00.000Z',
      uri: photo.uri,
    }),
  ),
}));

import { extractPhotoExif } from './photoExif';
import { resizePhotoForStorage } from './imageResize';
import { saveGuestPhoto } from './guestPhotoStorage';
import { captureGuestPhoto } from './guestPhotoCapture';

const ORIGINAL_PHOTO = { uri: 'original-uri' };
const LID_COORDS = { latitude: 35.0001, longitude: 139.0001 };

describe('captureGuestPhoto', () => {
  it('reads EXIF strictly before resizing', async () => {
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);

    // Order matters: resizing strips EXIF (see imageResize.ts), so if this
    // ever ran resize first, extractPhotoExif would receive the
    // already-resized photo and silently lose GPS — exactly the regression
    // this test exists to catch.
    const exifOrder = vi.mocked(extractPhotoExif).mock.invocationCallOrder[0];
    const resizeOrder = vi.mocked(resizePhotoForStorage).mock.invocationCallOrder[0];
    expect(exifOrder).toBeLessThan(resizeOrder);
  });

  it('passes the ORIGINAL photo to extractPhotoExif, never the resized one', async () => {
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);
    expect(extractPhotoExif).toHaveBeenCalledWith(ORIGINAL_PHOTO);
  });

  it('passes the ORIGINAL photo to resizePhotoForStorage, not something already processed', async () => {
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);
    expect(resizePhotoForStorage).toHaveBeenCalledWith(ORIGINAL_PHOTO);
  });

  it('saves the RESIZED photo, not the original', async () => {
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);
    expect(saveGuestPhoto).toHaveBeenCalledWith(
      'lid-1',
      { uri: 'resized-uri' },
      expect.any(Number),
      '2026-01-01T00:00:00.000Z',
    );
  });

  it('computes distance from the EXIF coordinates to the poke lid, not left null', async () => {
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);
    const [, , distanceMeters] = vi.mocked(saveGuestPhoto).mock.calls.at(-1)!;
    // ~35.0,139.0 to ~35.0001,139.0001 is on the order of tens of meters —
    // not re-asserting haversineDistanceMeters' own math (that's
    // packages/shared's test), just that a real number came through.
    expect(distanceMeters).toBeGreaterThan(0);
    expect(distanceMeters).toBeLessThan(100);
  });

  it('passes null distance when EXIF has no GPS at all', async () => {
    vi.mocked(extractPhotoExif).mockResolvedValueOnce({
      latitude: null,
      longitude: null,
      capturedAt: null,
    });
    await captureGuestPhoto('lid-1', ORIGINAL_PHOTO, LID_COORDS);
    expect(saveGuestPhoto).toHaveBeenCalledWith('lid-1', { uri: 'resized-uri' }, null, null);
  });
});
