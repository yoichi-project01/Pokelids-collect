import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  chunk,
  isBulkSyncStopStatus,
  municipalityKey,
  partitionGuestRecordsForSync,
  tallyMedalCounts,
  type PhotoMedal,
  type PokeLidDto,
  type ProgressDto,
} from '@pokelids/shared';
import POKE_LIDS from '../data/poke-lids.json';
import { ApiError, uploadCollection, uploadCollectionsBulk, type BulkUploadItem } from './api';
import { getAllGuestPhotos, getGuestPhotoForUpload, removeGuestPhoto } from './guestPhotoStorage';

const STORAGE_KEY = 'pokelids_guest_collections';

// Built once from the bundled snapshot (7-7) so mergeGuestProgress below can
// resolve a guest record's municipality from just its pokeLidId — a guest
// record only carries prefectureId (recorded at save time), not
// municipality, so this lookup is what makes the 7-5 merge possible without
// changing GuestCollection's stored shape (which would strand already-saved
// AsyncStorage data from before this field existed).
const POKE_LIDS_BY_ID = new Map((POKE_LIDS as PokeLidDto[]).map((l) => [l.id, l]));

export interface GuestCollection {
  pokeLidId: string;
  prefectureId: number;
  visitedAt: string;
  notes: string | null;
}

async function readAll(): Promise<GuestCollection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(items: GuestCollection[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function getGuestCollections(): Promise<GuestCollection[]> {
  return readAll();
}

export async function getGuestCollection(pokeLidId: string): Promise<GuestCollection | null> {
  const items = await readAll();
  return items.find((i) => i.pokeLidId === pokeLidId) ?? null;
}

export async function getGuestCollectedIds(): Promise<Set<string>> {
  const items = await readAll();
  return new Set(items.map((i) => i.pokeLidId));
}

export async function setGuestCollected(
  pokeLidId: string,
  prefectureId: number,
  notes: string | null,
): Promise<void> {
  const items = await readAll();
  const existing = items.find((i) => i.pokeLidId === pokeLidId);
  const visitedAt = existing?.visitedAt ?? new Date().toISOString();
  const next = items.filter((i) => i.pokeLidId !== pokeLidId);
  next.push({ pokeLidId, prefectureId, visitedAt, notes });
  await writeAll(next);
}

export async function removeGuestCollected(pokeLidId: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter((i) => i.pokeLidId !== pokeLidId));
}

export async function clearGuestCollections(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

// Matches apps/api's collections.ts MAX_BULK_PHOTOS — kept as a separate
// constant (not shared, unlike the pure functions above) since the two
// sides genuinely can drift independently without breaking anything: the
// server enforces its own limit regardless of what a client sends, so this
// number only controls request *count*, not correctness.
const BULK_CHUNK_SIZE = 5;

export interface GuestSyncResult {
  // A "record" is one GuestCollection entry — counted as synced once it's
  // been fully removed from local storage (see below for exactly when
  // that happens for a photo-bearing record vs a text-only one).
  recordsSyncedCount: number;
  recordsTotalCount: number;
  medalCounts: Record<PhotoMedal, number>;
  // True if a chunk-level limit (bulkUploadRateLimit or
  // MAX_USER_STORAGE_BYTES, see isBulkSyncStopStatus) cut the photo sync
  // short — the remaining photos are left in local storage exactly as if
  // this sync had never run, ready for the next login's retry.
  stoppedByLimit: boolean;
  limitMessage: string | null;
}

// Called once after login/register succeeds (7-9 phase 1 for text, phase 2
// for photos). Two independent phases, run concurrently since they hit
// different endpoints with different rate-limit pools (see
// apps/api/src/routes/collections.ts):
//
// - Text-only records (no local photo) go through the plain, cheap
//   POST /api/collections the same way they always have — an upsert, so a
//   partially-failed retry is safe, same as before this function grew a
//   photo path.
// - Photo-bearing records go through POST /api/collections/bulk instead,
//   chunked to BULK_CHUNK_SIZE photos per request. Deliberately NOT also
//   sent through the plain endpoint — see partitionGuestRecordsForSync's
//   doc comment (@pokelids/shared) for why the bulk endpoint already
//   covers their notes/visitedAt as a side effect of the first photo it
//   accepts for that poke lid.
//
// No new field was added to GuestCollection to track "photos pending" —
// deliberately. The *current contents* of guestStorage (this file) and
// guestPhotoStorage already say everything that needs saying: a
// photo-bearing record is exactly as done as "how many of its local
// GuestPhoto rows still exist." A sync interrupted halfway (tab closed,
// network dropped) needs no special resume state beyond that — whatever's
// still in local storage when this runs again next login *is* the correct
// pending set, because each photo is only removed from local storage
// (removeGuestPhoto, called per-item below, not batched until the end)
// immediately after the server has actually confirmed it. This matters
// more here than it did for the old text-only sync: unlike the collection
// upsert, re-uploading an already-synced photo isn't idempotent — it would
// create a second Photo row for the same image — so persisting "this one
// is done" as early as possible, not just "the whole sync is done," is
// what keeps a resumed sync from double-uploading.
export async function syncGuestCollectionsToAccount(
  onProgress?: (fraction: number) => void,
): Promise<GuestSyncResult> {
  const [collections, photos] = await Promise.all([getGuestCollections(), getAllGuestPhotos()]);
  const recordsTotalCount = collections.length;

  const { textOnly, withPhotos } = partitionGuestRecordsForSync(
    collections,
    photos.map((p) => p.pokeLidId),
  );
  const collectionsByPokeLidId = new Map(withPhotos.map((c) => [c.pokeLidId, c]));
  const photosToSync = photos.filter((p) => collectionsByPokeLidId.has(p.pokeLidId));

  const textSyncPromise = (async () => {
    const results = await Promise.allSettled(
      textOnly.map((item) =>
        uploadCollection({
          pokeLidId: item.pokeLidId,
          notes: item.notes ?? undefined,
          visitedAt: item.visitedAt,
        }),
      ),
    );
    let syncedCount = 0;
    for (let i = 0; i < textOnly.length; i++) {
      if (results[i].status === 'fulfilled') {
        await removeGuestCollected(textOnly[i].pokeLidId);
        syncedCount += 1;
      }
    }
    return syncedCount;
  })();

  const photoChunks = chunk(photosToSync, BULK_CHUNK_SIZE);
  const totalPhotos = photosToSync.length;
  let photosDone = 0;
  let stoppedByLimit = false;
  let limitMessage: string | null = null;
  const medals: PhotoMedal[] = [];
  const pokeLidIdsWithSyncedPhoto = new Set<string>();

  for (const photoChunk of photoChunks) {
    if (stoppedByLimit) break;

    const items: (BulkUploadItem & { photoId: string })[] = [];
    for (const photo of photoChunk) {
      const uploadInput = await getGuestPhotoForUpload(photo.id);
      // The blob/file went missing from storage (e.g. Safari's eviction —
      // exactly the risk 7-10 exists to reduce, not eliminate) — nothing to
      // upload; its stale metadata gets cleaned up the next time
      // getAllGuestPhotos runs (see that function's own doc comment).
      if (!uploadInput) continue;
      const collection = collectionsByPokeLidId.get(photo.pokeLidId)!;
      items.push({
        pokeLidId: photo.pokeLidId,
        notes: collection.notes ?? undefined,
        visitedAt: collection.visitedAt,
        photo: uploadInput,
        photoId: photo.id,
      });
    }

    if (items.length > 0) {
      try {
        const response = await uploadCollectionsBulk(items, (fraction) => {
          onProgress?.(Math.min(1, (photosDone + fraction * items.length) / Math.max(totalPhotos, 1)));
        });
        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          const item = items[i];
          // A result without `medal` is this specific photo's own failure
          // (e.g. that record already had 5 photos) — not a reason to stop
          // the whole sync, just leaves this one photo local for retry.
          if (result.medal) {
            medals.push(result.medal);
            pokeLidIdsWithSyncedPhoto.add(item.pokeLidId);
            await removeGuestPhoto(item.photoId);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && isBulkSyncStopStatus(err.status)) {
          stoppedByLimit = true;
          limitMessage = err.message;
        }
        // Otherwise: this chunk's own network/server hiccup — its photos
        // stay local, next chunk still gets a try.
      }
    }

    photosDone += photoChunk.length;
    onProgress?.(Math.min(1, photosDone / Math.max(totalPhotos, 1)));
  }

  // Re-read rather than trust in-memory bookkeeping: what's actually left
  // in storage (not "which chunks did we attempt") is what determines
  // whether a record is done, per this function's own doc comment above.
  const remainingPokeLidIds = new Set((await getAllGuestPhotos()).map((p) => p.pokeLidId));
  let photoRecordsSyncedCount = 0;
  for (const pokeLidId of pokeLidIdsWithSyncedPhoto) {
    if (!remainingPokeLidIds.has(pokeLidId)) {
      await removeGuestCollected(pokeLidId);
      photoRecordsSyncedCount += 1;
    }
  }

  const textSyncedCount = await textSyncPromise;

  return {
    recordsSyncedCount: textSyncedCount + photoRecordsSyncedCount,
    recordsTotalCount,
    medalCounts: tallyMedalCounts(medals),
    stoppedByLimit,
    limitMessage,
  };
}

// Server-side progress totals don't know about guest-local marks, so we add
// them in on the client for the (logged-out) browsing view. Municipality
// counts (7-5) additionally need POKE_LIDS_BY_ID above, since a guest record
// alone doesn't carry its municipality.
export function mergeGuestProgress(progress: ProgressDto, guestCollections: GuestCollection[]): ProgressDto {
  if (guestCollections.length === 0) return progress;

  const countByPrefecture = new Map<number, number>();
  const countByMunicipality = new Map<string, number>();
  for (const item of guestCollections) {
    countByPrefecture.set(item.prefectureId, (countByPrefecture.get(item.prefectureId) ?? 0) + 1);
    const lid = POKE_LIDS_BY_ID.get(item.pokeLidId);
    if (lid) {
      const key = municipalityKey(lid.prefectureId, lid.municipality);
      countByMunicipality.set(key, (countByMunicipality.get(key) ?? 0) + 1);
    }
  }

  return {
    totalPokeLids: progress.totalPokeLids,
    collectedCount: progress.collectedCount + guestCollections.length,
    byPrefecture: progress.byPrefecture.map((p) => ({
      ...p,
      collected: p.collected + (countByPrefecture.get(p.prefectureId) ?? 0),
    })),
    byMunicipality: progress.byMunicipality.map((m) => ({
      ...m,
      collected:
        m.collected + (countByMunicipality.get(municipalityKey(m.prefectureId, m.municipality)) ?? 0),
    })),
  };
}
