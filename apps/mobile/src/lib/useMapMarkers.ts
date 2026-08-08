import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { haversineDistanceMeters, isPokeLidVisible, QUICK_RECORD_RADIUS_METERS } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLids } from './api';
import { useAuth } from './auth';
import { getGuestCollectedIds } from './guestStorage';
import { getCurrentLocation, type Coordinates } from './location';
import type { MapMarkerData } from './mapHtml';

// Bare marker data — everything except canQuickRecord, which depends on
// `location` and is computed separately below (see `markers`) so a location
// fix arriving after the poke lid fetch already resolved doesn't require
// refetching or rebuilding this array.
type RawMarkerData = Omit<MapMarkerData, 'canQuickRecord'>;

export function useMapMarkers(): {
  markers: MapMarkerData[] | null;
  location: Coordinates | null;
  error: boolean;
  // True while a fetch is in flight, including refetches after the initial
  // load — distinct from `markers === null`, which only covers the very
  // first load. Lets the map screens show a small in-place spinner on the
  // manual refresh button instead of hiding the map every time.
  refreshing: boolean;
  reload: () => void;
} {
  const { user, isLoading: authLoading } = useAuth();
  const [rawMarkers, setRawMarkers] = useState<RawMarkerData[] | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  // Refetch on every focus, not just on mount: both map screens live in a
  // persistent tab and never unmount, so without this a newly-recorded poke
  // lid would keep showing as an uncollected (grey) pin on this tab until
  // the app was restarted. `reload()` (below) re-triggers this same effect
  // for the manual refresh button, so there's only one fetch to keep in sync.
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setRefreshing(true);
      Promise.all([fetchPokeLids(), fetchMyCollections(), getGuestCollectedIds()])
        .then(([lids, collections, guestIds]) => {
          if (cancelled) return;
          const collectedIds = new Set([...collections.map((c) => c.pokeLidId), ...guestIds]);
          setRawMarkers(
            lids
              .filter((l) => isPokeLidVisible(l.retiredAt, collectedIds.has(l.id)))
              .map((l) => ({
                id: l.id,
                lat: l.latitude,
                lng: l.longitude,
                name: `${l.municipality}｜${l.pokemonFeatured.join('・')}`,
                imageUrl: l.officialImageUrl,
                collected: collectedIds.has(l.id),
              })),
          );
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setRefreshing(false);
        });
      return () => {
        cancelled = true;
      };
      // `user` isn't read in the body, but its identity changes on
      // login/logout and that's exactly when collections/guest-merge data
      // needs to be refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, reloadKey]),
  );

  // Recomputed whenever either input changes — in particular, when `location`
  // resolves after `rawMarkers` already loaded (the location fetch and the
  // poke-lid fetch are two independent, differently-timed effects), this
  // re-derives canQuickRecord for the existing markers instead of needing a
  // refetch.
  const markers = useMemo<MapMarkerData[] | null>(() => {
    if (!rawMarkers) return null;
    return rawMarkers.map((m) => ({
      ...m,
      canQuickRecord:
        location !== null &&
        haversineDistanceMeters(location.latitude, location.longitude, m.lat, m.lng) <=
          QUICK_RECORD_RADIUS_METERS,
    }));
  }, [rawMarkers, location]);

  return { markers, location, error, refreshing, reload: () => setReloadKey((k) => k + 1) };
}
