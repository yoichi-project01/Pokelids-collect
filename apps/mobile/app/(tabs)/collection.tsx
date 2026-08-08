import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type PokeLidDto } from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, photoUrl } from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';
import { formatDateJST } from '../../src/lib/date';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useIsNarrowScreen,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

export default function CollectionScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [lidsById, setLidsById] = useState<Map<string, PokeLidDto>>(new Map());
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
    const [collectionsRes, lidsRes] = await Promise.all([fetchMyCollections(), fetchPokeLids()]);
    return { collections: collectionsRes, lidsById: new Map(lidsRes.map((l) => [l.id, l])) };
  }, []);

  // Refetch on every focus, not just on mount: this screen lives in a
  // persistent tab and never unmounts, so without this it would keep
  // showing whatever was loaded the first time the tab was opened — missing
  // records added from the map tab, and eventually serving photo thumbnail
  // URLs whose signed access tokens have expired.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadCollections()
        .then((result) => {
          if (cancelled) return;
          setCollections(result.collections);
          setLidsById(result.lidsById);
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

  const gridData = useGridData(collections, columns);

  return (
    <ScreenContainer>
      <Head>
        <title>収集記録 - ポケふた収集</title>
      </Head>
      {error && collections.length === 0 ? (
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
            stats && (
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
            )
          }
          renderItem={({ item }) => {
            if (item === null) return <View style={styles.placeholder} />;
            const lid = lidsById.get(item.pokeLidId);
            const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
            const retired = lid?.retiredAt != null;
            return (
              <PokeLidCard
                title={lid?.municipality ?? '（不明）'}
                subtitle={formatDateJST(item.visitedAt)}
                imageUri={primaryPhoto ? photoUrl(primaryPhoto.thumbUrl) : lid?.officialImageUrl}
                collected
                badge={
                  retired ? (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>撤去済み</Text>
                    </View>
                  ) : primaryPhoto && primaryPhoto.medal !== 'NONE' ? (
                    <Text style={styles.medal}>{MEDAL_EMOJI[primaryPhoto.medal]}</Text>
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
