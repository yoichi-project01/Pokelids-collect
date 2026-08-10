import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// 7-9 (phase 1): lets a guest keep a photo on their own device, with no
// server round trip. Metadata (which poke lid, computed distance, when) is
// small and structured, so it lives in AsyncStorage on both platforms —
// same store type guestStorage.ts already uses for GuestCollection — while
// the photo bytes themselves go to whichever heavy-storage backend the
// platform actually has:
//
// - Web: IndexedDB, storing the Blob directly. Chosen over OPFS for this
//   phase because it needs zero low-level file-handle bookkeeping (no
//   getDirectory/getFileHandle/createWritable dance) — this only ever does
//   simple whole-blob put/get/delete on a handful of records (≤30, see
//   MAX_GUEST_PHOTOS_TOTAL), never partial reads/writes or high-frequency
//   access, which is exactly the case OPFS's extra API surface is for.
//   IndexedDB's Blob support has also been solid across current browsers
//   for years, unlike OPFS which is comparatively new (Baseline since March
//   2023). Both are subject to the *same* origin storage quota and
//   eviction rules either way (see the UI-copy note below) — OPFS would not
//   have side-stepped that.
// - Native: expo-file-system, copied into Paths.document (survives app
//   restarts; unlike Paths.cache it isn't eligible for OS-triggered
//   cleanup under storage pressure).
//
// Whichever backend, this module is the only thing that knows which one —
// callers (poke-lids/[id].tsx, (tabs)/collection.tsx) just call
// saveGuestPhoto/getGuestPhotos/etc., same as location.ts/confirm.ts hide
// their own Platform.OS branching behind a platform-neutral function API.

export interface GuestPhoto {
  id: string;
  pokeLidId: string;
  // From EXIF, computed client-side (photoExif.ts) — never a confirmed
  // medal. See this module callers' doc comments for why.
  distanceMeters: number | null;
  capturedAt: string | null;
  savedAt: string;
}

export interface GuestPhotoWithUri extends GuestPhoto {
  // Web: a fresh blob: URL, created on read (object URLs don't survive a
  // reload, so this is never persisted — only the IndexedDB record is).
  // Native: the file's own stable file:// uri.
  uri: string;
}

export class GuestPhotoLimitError extends Error {}

// Matches the server's MAX_PHOTOS_PER_COLLECTION (collections.ts) — a
// guest's local cap shouldn't be more permissive than what an account can
// actually keep once synced (phase 2).
const MAX_PHOTOS_PER_RECORD = 5;
// Not a capacity limit (device/browser storage is generally in the
// hundreds of MB to GB range for this — see the 7-9 investigation notes) —
// this is a "don't let a guest quietly build up an unbounded pile of
// photos that may vanish (Safari's 7-day eviction) without ever being
// nudged to log in" ceiling.
const MAX_GUEST_PHOTOS_TOTAL = 30;
// Below this much free space, refuse new photos rather than risk a
// half-written record. A few MB of headroom past one photo's own size.
const MIN_FREE_BYTES_MARGIN = 5 * 1024 * 1024;

const META_STORAGE_KEY = 'pokelids_guest_photo_meta';

async function readAllMeta(): Promise<GuestPhoto[]> {
  const raw = await AsyncStorage.getItem(META_STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeAllMeta(items: GuestPhoto[]): Promise<void> {
  await AsyncStorage.setItem(META_STORAGE_KEY, JSON.stringify(items));
}

// ---- Web: IndexedDB blob store ----

const DB_NAME = 'pokelids-guest-photos';
const STORE_NAME = 'photos';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlobWeb(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getBlobWeb(id: string): Promise<Blob | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function deleteBlobWeb(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

// navigator.storage isn't implemented by every browser this app still
// needs to at least not crash on — treated as "can't tell, so don't block"
// rather than failing the save.
async function hasEnoughWebStorage(neededBytes: number): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return true;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage == null || quota == null) return true;
    return quota - usage >= neededBytes + MIN_FREE_BYTES_MARGIN;
  } catch {
    return true;
  }
}

// ---- Native: expo-file-system ----

function guestPhotoDirectory(): Directory {
  const dir = new Directory(Paths.document, 'guest-photos');
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function nativeFileFor(id: string): ExpoFile {
  return new ExpoFile(guestPhotoDirectory(), `${id}.jpg`);
}

// ---- Shared ----

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveGuestPhoto(
  pokeLidId: string,
  photo: { uri: string; webFile?: File },
  distanceMeters: number | null,
  capturedAt: string | null,
): Promise<GuestPhotoWithUri> {
  const meta = await readAllMeta();
  if (meta.filter((m) => m.pokeLidId === pokeLidId).length >= MAX_PHOTOS_PER_RECORD) {
    throw new GuestPhotoLimitError(`1件の記録に保存できる写真は${MAX_PHOTOS_PER_RECORD}枚までです。`);
  }
  if (meta.length >= MAX_GUEST_PHOTOS_TOTAL) {
    throw new GuestPhotoLimitError(
      `この端末に保存できる写真は合計${MAX_GUEST_PHOTOS_TOTAL}枚までです。ログインすると引き続き保存できます。`,
    );
  }

  const id = generateId();
  const record: GuestPhoto = { id, pokeLidId, distanceMeters, capturedAt, savedAt: new Date().toISOString() };

  let uri: string;
  if (Platform.OS === 'web') {
    if (!photo.webFile) throw new Error('写真の読み込みに失敗しました');
    if (!(await hasEnoughWebStorage(photo.webFile.size))) {
      throw new GuestPhotoLimitError(
        'この端末の空き容量が少ないため保存できませんでした。不要なデータを削除するか、ログインしてください。',
      );
    }
    await putBlobWeb(id, photo.webFile);
    uri = URL.createObjectURL(photo.webFile);
  } else {
    const dest = nativeFileFor(id);
    await new ExpoFile(photo.uri).copy(dest);
    uri = dest.uri;
  }

  await writeAllMeta([...meta, record]);
  return { ...record, uri };
}

async function resolveUri(id: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const blob = await getBlobWeb(id);
    return blob ? URL.createObjectURL(blob) : null;
  }
  const file = nativeFileFor(id);
  return file.exists ? file.uri : null;
}

// All guest photos across every record — the collection screen (7-9) needs
// this shape since it renders one grid, not one query per card. Total is
// capped at MAX_GUEST_PHOTOS_TOTAL, so resolving every URI up front is
// cheap; there's no pagination concern here the way there could be for a
// server-backed list.
export async function getAllGuestPhotos(): Promise<GuestPhotoWithUri[]> {
  const meta = await readAllMeta();
  const withUris = await Promise.all(
    meta.map(async (m) => {
      const uri = await resolveUri(m.id);
      return uri ? { ...m, uri } : null;
    }),
  );
  // A record whose blob/file went missing (e.g. IndexedDB got evicted
  // without warning, per Safari's 7-day rule) is dropped rather than shown
  // broken — its metadata is left in place, though, since resolveUri
  // failing doesn't necessarily mean *every* photo for that record is gone.
  return withUris.filter((p): p is GuestPhotoWithUri => p !== null);
}

export async function getGuestPhotos(pokeLidId: string): Promise<GuestPhotoWithUri[]> {
  const all = await getAllGuestPhotos();
  return all.filter((p) => p.pokeLidId === pokeLidId);
}

// Called when a guest un-marks a visit (onRemoveGuestVisited) — otherwise
// its photos would keep occupying storage and counting toward
// MAX_GUEST_PHOTOS_TOTAL with no way to reach them again.
export async function removeGuestPhotosFor(pokeLidId: string): Promise<void> {
  const meta = await readAllMeta();
  const toRemove = meta.filter((m) => m.pokeLidId === pokeLidId);
  if (toRemove.length === 0) return;

  await Promise.all(
    toRemove.map(async (m) => {
      if (Platform.OS === 'web') {
        await deleteBlobWeb(m.id);
        return;
      }
      // File.delete() is synchronous — wrapped in try/catch (not
      // .catch(), which would need a Promise) since a missing file
      // shouldn't block clearing this record's metadata.
      try {
        nativeFileFor(m.id).delete();
      } catch {
        // already gone — fine, metadata cleanup below still proceeds.
      }
    }),
  );
  await writeAllMeta(meta.filter((m) => m.pokeLidId !== pokeLidId));
}
