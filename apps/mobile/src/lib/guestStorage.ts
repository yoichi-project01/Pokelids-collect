import AsyncStorage from '@react-native-async-storage/async-storage';
import { municipalityKey, type PokeLidDto, type ProgressDto } from '@pokelids/shared';
import POKE_LIDS from '../data/poke-lids.json';
import { uploadCollection } from './api';

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

// Called once after login/register succeeds. Uploads each locally-recorded
// visit (no photo) in parallel; uploadCollection is an upsert, so retrying a
// partially-failed sync is safe. Only the items that failed are kept in
// local storage for the next attempt.
export async function syncGuestCollectionsToAccount(): Promise<number> {
  const items = await getGuestCollections();
  const results = await Promise.allSettled(
    items.map((item) =>
      uploadCollection({
        pokeLidId: item.pokeLidId,
        notes: item.notes ?? undefined,
        visitedAt: item.visitedAt,
      }),
    ),
  );

  const failed = items.filter((_, i) => results[i].status === 'rejected');
  await writeAll(failed);
  return items.length - failed.length;
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
