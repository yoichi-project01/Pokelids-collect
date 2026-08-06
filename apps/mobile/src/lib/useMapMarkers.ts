import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { isPokeLidVisible } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLids } from './api';
import { useAuth } from './auth';
import { getGuestCollectedIds } from './guestStorage';
import { getCurrentLocation, type Coordinates } from './location';
import type { MapMarkerData } from './mapHtml';

export function useMapMarkers(): {
  markers: MapMarkerData[] | null;
  location: Coordinates | null;
  error: boolean;
  reload: () => void;
} {
  const { user, isLoading: authLoading } = useAuth();
  const [markers, setMarkers] = useState<MapMarkerData[] | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  // Refetch on every focus, not just on mount: both map screens live in a
  // persistent tab and never unmount, so without this a newly-recorded poke
  // lid would keep showing as an uncollected (grey) pin on this tab until
  // the app was restarted.
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      Promise.all([fetchPokeLids(), fetchMyCollections(), getGuestCollectedIds()])
        .then(([lids, collections, guestIds]) => {
          if (cancelled) return;
          const collectedIds = new Set([...collections.map((c) => c.pokeLidId), ...guestIds]);
          setMarkers(
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

  return { markers, location, error, reload: () => setReloadKey((k) => k + 1) };
}
