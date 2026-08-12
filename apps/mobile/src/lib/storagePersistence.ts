import { Platform } from 'react-native';

// 7-10: keeps a guest's locally-saved photos out of the browser's
// eviction pool. Safari (iOS17+/macOS14+) silently deletes script-created
// data (IndexedDB included) from an origin the user hasn't interacted with
// in 7 days; Chrome/Firefox evict under disk pressure (LRU by last access).
// Getting the persist grant doesn't guarantee immortality, but it takes an
// origin out of both of those automatic-cleanup pools.
//
// There's no user-facing permission dialog for this in most browsers — the
// grant is decided silently based on engagement heuristics (visit
// frequency, bookmarks, installed-PWA status, etc). Calling persist() just
// asks; nothing to show or wait on beyond the returned boolean.

function hasStorageManager(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage?.persist === 'function'
  );
}

// Native has no browser-eviction concept at all — expo-file-system's
// Paths.document is the app's own sandboxed storage, not subject to any of
// the above, so there's nothing to request and nothing to report as "not
// persisted." Treated as persisted for the collection screen's banner
// wording (isStoragePersisted below), which is the only other caller that
// cares about the distinction.
export async function ensurePersistentStorage(): Promise<void> {
  if (!hasStorageManager()) return;
  try {
    // Avoids a redundant persist() call if this origin already has the
    // grant — not required for correctness (persist() is safe to call
    // repeatedly), just avoids doing the extra async round trip on every
    // guest's first-photo save from here on.
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) return;
    await navigator.storage.persist();
  } catch {
    // Best-effort — a failure here must not block the photo save that
    // triggered it.
  }
}

// For (tabs)/collection.tsx's guest banner (7-10): whether to keep the
// current "ログインすると安全に保管されます" wording, or switch to the
// more concrete (but still not alarming) version. `false` on an
// unsupported browser too — such a browser has no persist() capability at
// all, so its storage is fully at the mercy of whatever legacy eviction
// behavior it has, which is closer to "not persisted" than "persisted."
export async function isStoragePersisted(): Promise<boolean> {
  if (Platform.OS !== 'web') return true;
  if (!hasStorageManager()) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
