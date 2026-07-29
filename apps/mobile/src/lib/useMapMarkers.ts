import { useEffect, useState } from 'react';
import { fetchMyCollections, fetchPokeLids } from './api';
import type { MapMarkerData } from './mapHtml';

export function useMapMarkers(): MapMarkerData[] | null {
  const [markers, setMarkers] = useState<MapMarkerData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPokeLids(), fetchMyCollections()]).then(([lids, collections]) => {
      if (cancelled) return;
      const collectedIds = new Set(collections.map((c) => c.pokeLidId));
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
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return markers;
}
