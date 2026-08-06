import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type PokeLidDto } from '@pokelids/shared';
import { ErrorState } from '../../src/components/ErrorState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, photoUrl } from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import { colors, radius, spacing, typography } from '../../src/theme';

const GRID_COLUMNS = 3;
const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

export default function CollectionScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [lidsById, setLidsById] = useState<Map<string, PokeLidDto>>(new Map());
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  // Refetch on every focus, not just on mount: this screen lives in a
  // persistent tab and never unmounts, so without this it would keep
  // showing whatever was loaded the first time the tab was opened — missing
  // records added from the map tab, and eventually serving photo thumbnail
  // URLs whose signed access tokens have expired.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([fetchMyCollections(), fetchPokeLids()])
        .then(([collectionsRes, lidsRes]) => {
          if (cancelled) return;
          setCollections(collectionsRes);
          setLidsById(new Map(lidsRes.map((l) => [l.id, l])));
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
      return () => {
        cancelled = true;
      };
      // `reloadKey` isn't read in the body; it exists purely to force this
      // effect to re-run when the retry button is pressed.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]),
  );

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

  return (
    <ScreenContainer>
      <Head>
        <title>収集記録 - ポケふた収集</title>
      </Head>
      {error && collections.length === 0 ? (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      ) : (
        <FlatList
          data={collections}
          key={GRID_COLUMNS}
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>まだ収集記録がありません</Text>}
          ListHeaderComponent={
            stats && (
              <View style={styles.statsCard}>
                <View style={styles.statsRow}>
                  <Stat label="訪問した都道府県" value={`${stats.prefectureCount} / 47`} />
                  <Stat label="🥇獲得数" value={String(stats.goldCount)} />
                </View>
                <View style={styles.statsRow}>
                  <Stat label="最初の記録" value={stats.firstDate.toLocaleDateString('ja-JP')} />
                  <Stat label="最新の記録" value={stats.latestDate.toLocaleDateString('ja-JP')} />
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
            const lid = lidsById.get(item.pokeLidId);
            const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
            const retired = lid?.retiredAt != null;
            return (
              <PokeLidCard
                title={lid?.municipality ?? '（不明）'}
                subtitle={new Date(item.visitedAt).toLocaleDateString('ja-JP')}
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
  empty: { ...typography.caption, textAlign: 'center', color: colors.textTertiary, marginTop: 40 },
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
  stat: { flex: 1 },
  statValue: { ...typography.bodyMedium, fontSize: 18 },
  statLabel: { ...typography.footnote },
});
