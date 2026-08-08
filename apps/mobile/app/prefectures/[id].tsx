import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { isPokeLidVisible, PREFECTURES, type PokeLidDto } from '@pokelids/shared';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing } from '../../src/theme';

const PREFECTURE_COUNT = 47;

// Evaluated in Node.js at build time (see
// https://docs.expo.dev/router/web/static-rendering/#dynamic-routes). Without
// this, `web.output: "static"` only ever generates one literal
// `prefectures/[id].html` file, so every real request for e.g.
// `/prefectures/13` falls through to the SPA fallback (the *home* page's
// prerendered HTML) instead of this route's — which is what was causing the
// React hydration mismatch on this route.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return Array.from({ length: PREFECTURE_COUNT }, (_, i) => ({ id: String(i + 1) }));
}

export default function PrefecturePokeLidsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [lids, setLids] = useState<PokeLidDto[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uncollectedOnly, setUncollectedOnly] = useState(false);
  const columns = useResponsiveColumns();

  const prefectureName = PREFECTURES.find((p) => p.id === Number(id))?.nameJa ?? null;

  // Single fetch used by both the focus refetch below and pull-to-refresh.
  const loadPrefectureData = useCallback(async () => {
    const [lidsRes, collectionsRes, guestIds] = await Promise.all([
      fetchPokeLids(Number(id)),
      fetchMyCollections(),
      getGuestCollectedIds(),
    ]);
    return {
      lids: lidsRes,
      collectedIds: new Set([...collectionsRes.map((c) => c.pokeLidId), ...guestIds]),
    };
  }, [id]);

  // Refetch on every focus, not just on mount: this screen is pushed on top
  // of the tab it was opened from and stays mounted while e.g. a poke-lid
  // detail screen is on top of it, so without this, collecting a lid there
  // and coming back here wouldn't update its card until the app restarted.
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadPrefectureData()
        .then((result) => {
          if (cancelled) return;
          setLids(result.lids);
          setCollectedIds(result.collectedIds);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // `user` isn't read in the body, but its identity changes on
      // login/logout and that's exactly when collections/guest-merge data
      // needs to be refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, loadPrefectureData]),
  );

  function onRefresh() {
    setLoading(true);
    loadPrefectureData()
      .then((result) => {
        setLids(result.lids);
        setCollectedIds(result.collectedIds);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const visibleLids = useMemo(() => {
    // A retired lid only stays in the list if it's already been collected
    // (see isPokeLidVisible) — and "未収集のみ" excludes collected items by
    // definition, so the two filters together mean a retired lid never shows
    // up there.
    const notRetiredOrCollected = lids.filter((l) => isPokeLidVisible(l.retiredAt, collectedIds.has(l.id)));
    return uncollectedOnly
      ? notRetiredOrCollected.filter((l) => !collectedIds.has(l.id))
      : notRetiredOrCollected;
  }, [lids, collectedIds, uncollectedOnly]);

  const gridData = useGridData(visibleLids, columns);

  return (
    <ScreenContainer>
      <Head>
        <title>{prefectureName ? `${prefectureName} - ポケふた収集` : 'ポケふた収集'}</title>
        {prefectureName && (
          <meta
            name="description"
            content={`${prefectureName}にあるポケふた(ご当地ポケモンマンホール)の一覧。訪問して収集記録を残そう。`}
          />
        )}
      </Head>
      {error && lids.length === 0 ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <FlatList
          data={gridData}
          key={columns}
          numColumns={columns}
          keyExtractor={gridKeyExtractor((item) => item.id)}
          refreshing={loading}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <FilterChip
                label="すべて"
                selected={!uncollectedOnly}
                onPress={() => setUncollectedOnly(false)}
              />
              <FilterChip
                label="未収集のみ"
                selected={uncollectedOnly}
                onPress={() => setUncollectedOnly(true)}
              />
            </View>
          }
          renderItem={({ item }) => {
            if (item === null) return <View style={styles.placeholder} />;
            const collected = collectedIds.has(item.id);
            const retired = item.retiredAt != null;
            return (
              <PokeLidCard
                title={item.municipality}
                subtitle={item.pokemonFeatured.join('・')}
                imageUri={item.officialImageUrl}
                collected={collected}
                badge={
                  retired ? (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>撤去済み</Text>
                    </View>
                  ) : undefined
                }
                onPress={() => router.push(`/poke-lids/${item.id}`)}
              />
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.sm },
  // Matches PokeLidCard's own outer flex/padding so a trailing placeholder
  // cell takes up exactly as much row width as a real card would.
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  filterRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
});
