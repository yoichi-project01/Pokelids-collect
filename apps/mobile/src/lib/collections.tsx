import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CollectionDto } from '@pokelids/shared';
import { fetchMyCollections } from './api';
import { useAuth } from './auth';

// 7-6. Shared, app-wide collections state — replaces fetchMyCollections()
// being called independently by 5 screens (home, collection, map,
// prefecture detail, poke-lid detail) on every focus. Fetched once (see the
// root-mounted effect below), then kept current by mutation call sites
// calling upsertCollection/removeCollection with their own response bodies
// (4-4's endpoints already return the full updated collection/summary) —
// not by refetching. See the 40-minute safety-refresh note below for the one
// exception.
interface CollectionsContextValue {
  collections: CollectionDto[];
  // True only for the very first load and a login/logout-triggered reload —
  // this is NOT set during the 40-minute safety refresh or an explicit
  // refresh() call, both of which are meant to update quietly in the
  // background rather than flash a loading state a screen the user is
  // already looking at.
  loading: boolean;
  error: boolean;
  // Explicit re-fetch for pull-to-refresh / the map's refresh button (7-6's
  // own "明示的な更新手段では再取得すること") — screens must call this
  // themselves; nothing here refetches silently on a screen's behalf beyond
  // the initial load, login/logout, and the 40-minute safety timer.
  refresh: () => Promise<void>;
  // Patches one collection in place from a mutation's own response —
  // uploadCollection/deleteCollectionPhoto/setPrimaryPhoto all already
  // return the full updated CollectionDto, so every other screen reading
  // `collections` sees the change immediately, with no refetch.
  upsertCollection: (collection: CollectionDto) => void;
  removeCollection: (collectionId: string) => void;
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null);

// Comfortably under PHOTO_TOKEN_TTL_MS's 45 minutes (apps/api/src/lib/
// auth.ts) — collections are otherwise only refetched on the initial load,
// login/logout, or an explicit refresh, so a session left open on one screen
// for longer than the token's TTL needs its own trigger, or a photo's
// thumbnail/full-size URL (baked into `collection.photos[].url/thumbUrl` at
// fetch time) would silently start 401ing. Nothing here waits on a tab
// switch to notice.
const TOKEN_SAFETY_REFRESH_MS = 40 * 60 * 1000;

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchMyCollections();
      setCollections(result);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // This provider is mounted once, at the app root (see app/_layout.tsx),
  // above the tab navigator — so unlike each individual screen's own
  // useFocusEffect+authLoading gate (9aaefe9: a *focus* event can be missed
  // on a cold reload of a non-default tab, since expo-router's web output
  // resolves the real route slightly after the tab navigator's own initial
  // mount), a plain effect here isn't racing against navigation focus at
  // all. It fires once on mount regardless of which tab a cold reload or
  // deep link lands on, and again whenever authLoading resolves or `user`
  // changes (login/logout) — the same two conditions every per-screen fetch
  // already keyed off.
  useEffect(() => {
    if (authLoading) return;
    // Promise.resolve().then(...) rather than calling setLoading(true)
    // directly here — react-hooks' set-state-in-effect rule flags a
    // synchronous setState call in an effect body as a cascading-render
    // risk, even when (as here) the "async work" starts on literally the
    // next microtask. Same idiom as auth/google/callback.tsx's own effect,
    // for the same reason.
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => refresh())
      .finally(() => setLoading(false));
  }, [authLoading, user, refresh]);

  useEffect(() => {
    const interval = setInterval(() => {
      void refresh();
    }, TOKEN_SAFETY_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const upsertCollection = useCallback((collection: CollectionDto) => {
    setCollections((prev) => {
      const index = prev.findIndex((c) => c.id === collection.id);
      if (index === -1) return [collection, ...prev];
      const next = [...prev];
      next[index] = collection;
      return next;
    });
  }, []);

  const removeCollection = useCallback((collectionId: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
  }, []);

  return (
    <CollectionsContext.Provider
      value={{ collections, loading, error, refresh, upsertCollection, removeCollection }}
    >
      {children}
    </CollectionsContext.Provider>
  );
}

export function useCollections(): CollectionsContextValue {
  const ctx = useContext(CollectionsContext);
  if (!ctx) throw new Error('useCollections must be used within CollectionsProvider');
  return ctx;
}
