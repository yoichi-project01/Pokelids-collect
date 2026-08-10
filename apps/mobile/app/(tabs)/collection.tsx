import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import {
  haversineDistanceMeters,
  type CollectionDto,
  type PhotoMedal,
  type PokeLidDto,
} from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, photoUrl } from '../../src/lib/api';
import { formatDateJST } from '../../src/lib/date';
import { getAllGuestPhotos, type GuestPhotoWithUri } from '../../src/lib/guestPhotoStorage';
import { getGuestCollections, type GuestCollection } from '../../src/lib/guestStorage';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useIsNarrowScreen,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

// Normalizes both the server's CollectionDto (real, synced records — a
// confirmed medal) and a guest's local-only records (7-9 — no server
// round trip yet, so no confirmed medal, only whichever locally-saved
// photo happens to be first) into one shape the grid can render without
// caring which kind of record it's looking at.
interface CollectionGridItem {
  id: string;
  pokeLidId: string;
  visitedAt: string;
  imageUri: string | null | undefined;
  medal: PhotoMedal | null;
  isGuest: boolean;
}

const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

export default function CollectionScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [lidsById, setLidsById] = useState<Map<string, PokeLidDto>>(new Map());
  // Guest-local data (7-9) — kept separate from `collections`/server state
  // throughout, never merged into it, so nothing here can accidentally be
  // mistaken for a synced/confirmed record.
  const [guestCollections, setGuestCollections] = useState<GuestCollection[]>([]);
  const [guestPhotos, setGuestPhotos] = useState<GuestPhotoWithUri[]>([]);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const columns = useResponsiveColumns();
  const isNarrow = useIsNarrowScreen();

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  // Single fetch used by both the focus refetch below and pull-to-refresh,
  // so the two triggers can't drift into fetching different things.
  const loadCollections = useCallback(async () => {
    const [collectionsRes, lidsRes, guestCollectionsRes, guestPhotosRes] = await Promise.all([
      fetchMyCollections(),
      fetchPokeLids(),
      getGuestCollections(),
      getAllGuestPhotos(),
    ]);
    return {
      collections: collectionsRes,
      lidsById: new Map(lidsRes.map((l) => [l.id, l])),
      guestCollections: guestCollectionsRes,
      guestPhotos: guestPhotosRes,
    };
  }, []);

  // Refetch on every focus, not just on mount: this screen lives in a
  // persistent tab and never unmounts, so without this it would keep
  // showing whatever was loaded the first time the tab was opened — missing
  // records added from the map tab, and eventually serving photo thumbnail
  // URLs whose signed access tokens have expired. The same staleness risk
  // applies to guest photos now too (added on the poke-lid detail screen).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCollections()
        .then((result) => {
          if (cancelled) return;
          setCollections(result.collections);
          setLidsById(result.lidsById);
          setGuestCollections(result.guestCollections);
          setGuestPhotos(result.guestPhotos);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
      return () => {
        cancelled = true;
      };
    }, [loadCollections]),
  );

  function onRefresh() {
    setRefreshing(true);
    loadCollections()
      .then((result) => {
        setCollections(result.collections);
        setLidsById(result.lidsById);
        setGuestCollections(result.guestCollections);
        setGuestPhotos(result.guestPhotos);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }

  const stats = useMemo(() => {
    if (collections.length === 0) return null;

    const prefectureIds = new Set(
      collections
        .map((c) => lidsById.get(c.pokeLidId)?.prefectureId)
        .filter((id): id is number => id != null),
    );
    const goldCount = collections.filter(
      (c) => (c.photos.find((p) => p.isPrimary) ?? c.photos[0])?.medal === 'GOLD',
    ).length;
    const dates = collections.map((c) => new Date(c.visitedAt).getTime()).sort((a, b) => a - b);
    const firstDate = new Date(dates[0]);
    const latestDate = new Date(dates[dates.length - 1]);

    let farthest: { municipality: string; distanceKm: number } | null = null;
    if (location) {
      for (const c of collections) {
        const lid = lidsById.get(c.pokeLidId);
        if (!lid) continue;
        const distanceKm =
          haversineDistanceMeters(location.latitude, location.longitude, lid.latitude, lid.longitude) / 1000;
        if (!farthest || distanceKm > farthest.distanceKm) {
          farthest = { municipality: lid.municipality, distanceKm };
        }
      }
    }

    return {
      prefectureCount: prefectureIds.size,
      goldCount,
      firstDate,
      latestDate,
      farthest,
    };
  }, [collections, lidsById, location]);

  // Server records take precedence over a guest-local one for the same poke
  // lid — the only way that overlap happens is stale guest data left behind
  // from before an account existed (phase 2's sync will clear it), and
  // showing both would just be a confusing duplicate card.
  const gridItems = useMemo<CollectionGridItem[]>(() => {
    const serverItems: CollectionGridItem[] = collections.map((c) => {
      const primaryPhoto = c.photos.find((p) => p.isPrimary) ?? c.photos[0];
      return {
        id: c.id,
        pokeLidId: c.pokeLidId,
        visitedAt: c.visitedAt,
        imageUri: primaryPhoto
          ? photoUrl(primaryPhoto.thumbUrl)
          : lidsById.get(c.pokeLidId)?.officialImageUrl,
        medal: primaryPhoto?.medal ?? null,
        isGuest: false,
      };
    });

    const serverPokeLidIds = new Set(collections.map((c) => c.pokeLidId));
    const guestItems: CollectionGridItem[] = guestCollections
      .filter((g) => !serverPokeLidIds.has(g.pokeLidId))
      .map((g) => {
        // A guest record can have 0–5 photos (guestPhotoStorage's
        // per-record cap) — only the first stands in for the card, same as
        // a server record's primary photo.
        const photo = guestPhotos.find((p) => p.pokeLidId === g.pokeLidId);
        return {
          id: `guest-${g.pokeLidId}`,
          pokeLidId: g.pokeLidId,
          visitedAt: g.visitedAt,
          imageUri: photo?.uri ?? lidsById.get(g.pokeLidId)?.officialImageUrl,
          // Never a confirmed medal (7-9) — see poke-lids/[id].tsx's
          // captureGuestPhoto usage for why.
          medal: null,
          isGuest: true,
        };
      });

    return [...serverItems, ...guestItems];
  }, [collections, guestCollections, guestPhotos, lidsById]);

  const gridData = useGridData(gridItems, columns);

  return (
    <ScreenContainer>
      <Head>
        <title>収集記録 - ポケふたコレクト</title>
      </Head>
      {error && gridItems.length === 0 ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <FlatList
          data={gridData}
          key={columns}
          numColumns={columns}
          keyExtractor={gridKeyExtractor((item) => item.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="はじめての1枚を探しに行こう"
              message="地図で近くのポケふたを探して、訪れた記録を残していきましょう。"
              actionLabel="地図で探す"
              onAction={() => router.push('/map')}
            />
          }
          ListHeaderComponent={
            <>
              {guestCollections.length > 0 && (
                <View style={styles.guestBanner}>
                  <Text style={styles.guestBannerText}>
                    {guestCollections.length}件の記録がこの端末にあります。ログインすると安全に保管されます
                  </Text>
                </View>
              )}
              {stats && (
                <View style={styles.statsCard}>
                  <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                    <Stat label="訪問した都道府県" value={`${stats.prefectureCount} / 47`} />
                    <Stat label="🥇獲得数" value={String(stats.goldCount)} />
                  </View>
                  <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                    <Stat label="最初の記録" value={formatDateJST(stats.firstDate)} />
                    <Stat label="最新の記録" value={formatDateJST(stats.latestDate)} />
                  </View>
                  {stats.farthest && (
                    <Stat
                      label="一番遠くまで行った記録"
                      value={`${stats.farthest.municipality}（${stats.farthest.distanceKm.toFixed(1)}km）`}
                    />
                  )}
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            if (item === null) return <View style={styles.placeholder} />;
            const lid = lidsById.get(item.pokeLidId);
            const retired = lid?.retiredAt != null;
            return (
              <PokeLidCard
                title={lid?.municipality ?? '（不明）'}
                subtitle={formatDateJST(item.visitedAt)}
                imageUri={item.imageUri}
                collected
                badge={
                  retired ? (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>撤去済み</Text>
                    </View>
                  ) : item.medal && item.medal !== 'NONE' ? (
                    <Text style={styles.medal}>{MEDAL_EMOJI[item.medal]}</Text>
                  ) : undefined
                }
                onPress={() => lid && router.push(`/poke-lids/${lid.id}`)}
              />
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.sm },
  // Matches PokeLidCard's own outer flex/padding so a trailing placeholder
  // cell takes up exactly as much row width as a real card would.
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  medal: { fontSize: 20 },
  // attention (7-9), not danger — nothing has gone wrong, this is a nudge,
  // not an error. Deliberately plain (no border/icon) so it reads as a
  // standing notice rather than a dismissible warning.
  guestBanner: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    margin: spacing.sm,
    marginBottom: 0,
  },
  guestBannerText: {
    ...typography.footnote,
    color: colors.attention,
    fontWeight: '600',
    textAlign: 'center',
  },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    margin: spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: spacing.lg },
  // Below THREE_COLUMN_MIN_WIDTH a 2-column stat card leaves ~130px per
  // cell — not enough for values like "稚内市（1,203.4km）" — so stack
  // to one column instead of shrinking further.
  statsRowNarrow: { flexDirection: 'column', gap: spacing.md },
  stat: { flex: 1 },
  statValue: { ...typography.bodyMedium, fontSize: 18 },
  statLabel: { ...typography.footnote },
});
