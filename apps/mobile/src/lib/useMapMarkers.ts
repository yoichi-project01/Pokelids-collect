import { useEffect, useState } from 'react';
import { fetchMyCollections, fetchPokeLids } from './api';
import { useAuth } from './auth';
import { getGuestCollectedIds } from './guestStorage';
import type { MapMarkerData } from './mapHtml';

export function useMapMarkers(): MapMarkerData[] | null {
  const { user, isLoading: authLoading } = useAuth();
  const [markers, setMarkers] = useState<MapMarkerData[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLids(), fetchMyCollections(), getGuestCollectedIds()]).then(
      ([lids, collections, guestIds]) => {
        if (cancelled) return;
        const collectedIds = new Set([...collections.map((c) => c.pokeLidId), ...guestIds]);
        setMarkers(
          lids.map((l) => ({
            id: l.id,
            lat: l.latitude,
            lng: l.longitude,
            name: `${l.municipality}｜${l.pokemonFeatured.join('・')}`,
            imageUrl: l.officialImageUrl,
            collected: collectedIds.has(l.id),
          })),
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return markers;
}
