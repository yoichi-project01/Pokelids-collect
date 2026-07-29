import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PokeLidDto, ProgressDto } from '@pokelids/shared';
import { uploadCollection } from './api';

const STORAGE_KEY = 'pokelids_guest_collections';

export interface GuestCollection {
  pokeLidId: string;
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

export async function setGuestCollected(pokeLidId: string, notes: string | null): Promise<void> {
  const items = await readAll();
  const existing = items.find((i) => i.pokeLidId === pokeLidId);
  const visitedAt = existing?.visitedAt ?? new Date().toISOString();
  const next = items.filter((i) => i.pokeLidId !== pokeLidId);
  next.push({ pokeLidId, visitedAt, notes });
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
// visit (no photo) and clears local storage on success.
export async function syncGuestCollectionsToAccount(): Promise<number> {
  const items = await getGuestCollections();
  for (const item of items) {
    await uploadCollection({
      pokeLidId: item.pokeLidId,
      notes: item.notes ?? undefined,
      visitedAt: item.visitedAt,
    });
  }
  await clearGuestCollections();
  return items.length;
}

// Server-side progress totals don't know about guest-local marks, so we add
// them in on the client for the (logged-out) browsing view.
export function mergeGuestProgress(
  progress: ProgressDto,
  pokeLids: PokeLidDto[],
  guestIds: Set<string>,
): ProgressDto {
  if (guestIds.size === 0) return progress;

  const countByPrefecture = new Map<number, number>();
  for (const lid of pokeLids) {
    if (guestIds.has(lid.id)) {
      countByPrefecture.set(lid.prefectureId, (countByPrefecture.get(lid.prefectureId) ?? 0) + 1);
    }
  }

  return {
    totalPokeLids: progress.totalPokeLids,
    collectedCount: progress.collectedCount + guestIds.size,
    byPrefecture: progress.byPrefecture.map((p) => ({
      ...p,
      collected: p.collected + (countByPrefecture.get(p.prefectureId) ?? 0),
    })),
  };
}
