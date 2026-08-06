import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { isPokeLidVisible, PREFECTURES, type PokeLidDto } from '@pokelids/shared';
import { ErrorState } from '../../src/components/ErrorState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import { gridKeyExtractor, useGridData } from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

const GRID_COLUMNS = 3;
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
  const [reloadKey, setReloadKey] = useState(0);
  const [uncollectedOnly, setUncollectedOnly] = useState(false);

  const prefectureName = PREFECTURES.find((p) => p.id === Number(id))?.nameJa ?? null;

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLids(Number(id)), fetchMyCollections(), getGuestCollectedIds()])
      .then(([lidsRes, collectionsRes, guestIds]) => {
        if (cancelled) return;
        setLids(lidsRes);
        setCollectedIds(new Set([...collectionsRes.map((c) => c.pokeLidId), ...guestIds]));
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
  }, [id, authLoading, user, reloadKey]);

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

  const gridData = useGridData(visibleLids, GRID_COLUMNS);

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
        <ErrorState
          onRetry={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : (
        <FlatList
          data={gridData}
          key={GRID_COLUMNS}
          numColumns={GRID_COLUMNS}
          keyExtractor={gridKeyExtractor((item) => item.id)}
          refreshing={loading}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.filterRow}>
              <Text
                style={[styles.filterOption, !uncollectedOnly && styles.filterOptionActive]}
                onPress={() => setUncollectedOnly(false)}
              >
                すべて
              </Text>
              <Text
                style={[styles.filterOption, uncollectedOnly && styles.filterOptionActive]}
                onPress={() => setUncollectedOnly(true)}
              >
                未収集のみ
              </Text>
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
  placeholder: { flex: 1, padding: spacing.xs },
  filterRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  filterOption: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  filterOptionActive: { color: colors.white, backgroundColor: colors.accent, borderColor: colors.accent },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
});
