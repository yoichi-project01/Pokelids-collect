import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AsyncStorage's real package pulls in react-native internals that Vite
// can't parse (Flow syntax) — same issue guestPhotoCapture.test.ts ran
// into with a different module. A tiny in-memory fake is enough: this
// file's subject only ever calls getItem/setItem/removeItem.
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

vi.mock('./api', async () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    uploadCollection: vi.fn(async () => ({ collection: {}, summary: {} })),
    uploadCollectionsBulk: vi.fn(async () => ({ results: [] })),
  };
});

vi.mock('./guestPhotoStorage', () => ({
  getAllGuestPhotos: vi.fn(async () => []),
  getGuestPhotoForUpload: vi.fn(async (id: string) => ({
    uri: `uri-${id}`,
    name: `${id}.jpg`,
    type: 'image/jpeg',
  })),
  removeGuestPhoto: vi.fn(async () => {}),
}));

import { ApiError, uploadCollection, uploadCollectionsBulk } from './api';
import { getAllGuestPhotos, getGuestPhotoForUpload, removeGuestPhoto } from './guestPhotoStorage';
import {
  getGuestCollections,
  setGuestCollected,
  syncGuestCollectionsToAccount,
  type GuestCollection,
} from './guestStorage';

function guestPhoto(id: string, pokeLidId: string) {
  return {
    id,
    pokeLidId,
    distanceMeters: null,
    capturedAt: null,
    savedAt: '2026-01-01T00:00:00.000Z',
    uri: `uri-${id}`,
  };
}

beforeEach(async () => {
  store.clear();
  vi.clearAllMocks();
  vi.mocked(getAllGuestPhotos).mockResolvedValue([]);
  vi.mocked(getGuestPhotoForUpload).mockImplementation(async (id: string) => ({
    uri: `uri-${id}`,
    name: `${id}.jpg`,
    type: 'image/jpeg',
  }));
  vi.mocked(uploadCollection).mockResolvedValue({ collection: {}, summary: {} } as never);
  vi.mocked(uploadCollectionsBulk).mockResolvedValue({ results: [] });
});

afterEach(() => {
  store.clear();
});

describe('syncGuestCollectionsToAccount — text-only records', () => {
  it('removes a record locally once its text sync succeeds', async () => {
    await setGuestCollected('lid-1', 1, null);
    const result = await syncGuestCollectionsToAccount();

    expect(result.recordsSyncedCount).toBe(1);
    expect(result.recordsTotalCount).toBe(1);
    expect(await getGuestCollections()).toEqual([]);
  });

  it('keeps a record locally when its text sync fails', async () => {
    vi.mocked(uploadCollection).mockRejectedValueOnce(new ApiError(500, 'server error'));
    await setGuestCollected('lid-1', 1, null);
    const result = await syncGuestCollectionsToAccount();

    expect(result.recordsSyncedCount).toBe(0);
    expect(await getGuestCollections()).toHaveLength(1);
  });

  it('never calls uploadCollectionsBulk for a record with no local photo', async () => {
    await setGuestCollected('lid-1', 1, null);
    await syncGuestCollectionsToAccount();
    expect(uploadCollectionsBulk).not.toHaveBeenCalled();
  });
});

describe('syncGuestCollectionsToAccount — photo-bearing records', () => {
  it('does NOT call the plain uploadCollection for a record that has a local photo', async () => {
    await setGuestCollected('lid-1', 1, null);
    vi.mocked(getAllGuestPhotos).mockResolvedValue([guestPhoto('p1', 'lid-1')]);
    vi.mocked(uploadCollectionsBulk).mockResolvedValue({
      results: [{ pokeLidId: 'lid-1', photoId: 'p1', medal: 'GOLD' }],
    });

    await syncGuestCollectionsToAccount();
    expect(uploadCollection).not.toHaveBeenCalled();
  });

  it('removes the record once its only photo syncs successfully', async () => {
    await setGuestCollected('lid-1', 1, null);
    vi.mocked(getAllGuestPhotos)
      .mockResolvedValueOnce([guestPhoto('p1', 'lid-1')]) // initial read
      .mockResolvedValueOnce([]); // re-read after sync, for the "still pending?" check
    vi.mocked(uploadCollectionsBulk).mockResolvedValue({
      results: [{ pokeLidId: 'lid-1', photoId: 'p1', medal: 'GOLD' }],
    });

    const result = await syncGuestCollectionsToAccount();

    expect(removeGuestPhoto).toHaveBeenCalledWith('p1');
    expect(result.recordsSyncedCount).toBe(1);
    expect(result.medalCounts).toEqual({ GOLD: 1, SILVER: 0, NONE: 0 });
    expect(await getGuestCollections()).toEqual([]);
  });

  it('keeps the record when only some of its photos synced', async () => {
    await setGuestCollected('lid-1', 1, null);
    vi.mocked(getAllGuestPhotos)
      .mockResolvedValueOnce([guestPhoto('p1', 'lid-1'), guestPhoto('p2', 'lid-1')])
      // Still has p2 left after the sync — its own upload wasn't in this
      // mocked chunk's results at all, simulating a partial-chunk failure.
      .mockResolvedValueOnce([guestPhoto('p2', 'lid-1')]);
    vi.mocked(uploadCollectionsBulk).mockResolvedValue({
      results: [{ pokeLidId: 'lid-1', photoId: 'p1', medal: 'SILVER' }],
    });

    const result = await syncGuestCollectionsToAccount();

    expect(result.recordsSyncedCount).toBe(0);
    expect(await getGuestCollections()).toHaveLength(1);
  });

  it('splits more than BULK_CHUNK_SIZE photos across multiple bulk requests', async () => {
    await setGuestCollected('lid-1', 1, null);
    const photos = Array.from({ length: 7 }, (_, i) => guestPhoto(`p${i}`, 'lid-1'));
    vi.mocked(getAllGuestPhotos).mockResolvedValueOnce(photos).mockResolvedValueOnce([]);
    vi.mocked(uploadCollectionsBulk).mockImplementation(async (items) => ({
      results: items.map((item) => ({ pokeLidId: item.pokeLidId, medal: 'GOLD' as const })),
    }));

    await syncGuestCollectionsToAccount();

    // 7 photos at chunk size 5 → 2 requests (5 + 2), not 1 and not 7.
    expect(uploadCollectionsBulk).toHaveBeenCalledTimes(2);
    const callSizes = vi.mocked(uploadCollectionsBulk).mock.calls.map(([items]) => items.length);
    expect(callSizes.sort()).toEqual([2, 5]);
  });

  it('stops after a chunk-level 429 and leaves the rest of that record local', async () => {
    await setGuestCollected('lid-1', 1, null);
    const photos = Array.from({ length: 7 }, (_, i) => guestPhoto(`p${i}`, 'lid-1'));
    vi.mocked(getAllGuestPhotos).mockResolvedValueOnce(photos).mockResolvedValueOnce(photos);
    vi.mocked(uploadCollectionsBulk).mockRejectedValue(new ApiError(429, 'レート制限に達しました'));

    const result = await syncGuestCollectionsToAccount();

    expect(result.stoppedByLimit).toBe(true);
    expect(result.limitMessage).toBe('レート制限に達しました');
    expect(removeGuestPhoto).not.toHaveBeenCalled();
    // Second chunk is never attempted once the first one signals a stop.
    expect(uploadCollectionsBulk).toHaveBeenCalledTimes(1);
  });

  it('does not stop the sync for a per-item failure (no top-level error thrown)', async () => {
    await setGuestCollected('lid-1', 1, null);
    vi.mocked(getAllGuestPhotos)
      .mockResolvedValueOnce([guestPhoto('p1', 'lid-1')])
      .mockResolvedValueOnce([guestPhoto('p1', 'lid-1')]);
    // A per-item error (e.g. that record already had 5 photos) comes back
    // as a normal 201 response with no `medal` on this item — not a thrown
    // ApiError, so it must not set stoppedByLimit.
    vi.mocked(uploadCollectionsBulk).mockResolvedValue({
      results: [{ pokeLidId: 'lid-1', error: '1件の収集記録に登録できる写真は5枚までです。' }],
    });

    const result = await syncGuestCollectionsToAccount();

    expect(result.stoppedByLimit).toBe(false);
    expect(removeGuestPhoto).not.toHaveBeenCalled();
  });
});

describe('syncGuestCollectionsToAccount — mixed batch', () => {
  it('syncs text-only and photo-bearing records independently in one call', async () => {
    await setGuestCollected('lid-text', 1, null);
    await setGuestCollected('lid-photo', 1, null);
    vi.mocked(getAllGuestPhotos)
      .mockResolvedValueOnce([guestPhoto('p1', 'lid-photo')])
      .mockResolvedValueOnce([]);
    vi.mocked(uploadCollectionsBulk).mockResolvedValue({
      results: [{ pokeLidId: 'lid-photo', photoId: 'p1', medal: 'NONE' }],
    });

    const result = await syncGuestCollectionsToAccount();

    expect(result.recordsSyncedCount).toBe(2);
    expect(result.recordsTotalCount).toBe(2);
    expect(uploadCollection).toHaveBeenCalledTimes(1);
    expect(uploadCollection).toHaveBeenCalledWith(expect.objectContaining({ pokeLidId: 'lid-text' }));
    expect(uploadCollectionsBulk).toHaveBeenCalledTimes(1);
    expect(await getGuestCollections()).toEqual([]);
  });
});

type _UnusedGuestCollectionImportCheck = GuestCollection;
