import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import {
  classifyCompletion,
  countsTowardProgress,
  isPokeLidVisible,
  PREFECTURES,
  type PokeLidDto,
} from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchPokeLids } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useCollections } from '../../src/lib/collections';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import {
  chunkIntoRows,
  GRID_CELL_PADDING,
  rowKeyExtractor,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

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
  const { collections, refresh: refreshCollections } = useCollections();
  const [lids, setLids] = useState<PokeLidDto[]>([]);
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [uncollectedOnly, setUncollectedOnly] = useState(false);
  const columns = useResponsiveColumns();

  const prefectureName = PREFECTURES.find((p) => p.id === Number(id))?.nameJa ?? null;

  // Single fetch used by both the focus refetch below and pull-to-refresh.
  // `collections` (server-side) comes from the shared context (7-6) instead
  // — see the collectedIds useMemo below.
  const loadPrefectureData = useCallback(async () => {
    const [lidsRes, guestIdsRes] = await Promise.all([fetchPokeLids(Number(id)), getGuestCollectedIds()]);
    return { lids: lidsRes, guestIds: guestIdsRes };
  }, [id]);

  // Refetch on every focus, not just on mount: this screen is pushed on top
  // of the tab it was opened from and stays mounted while e.g. a poke-lid
  // detail screen is on top of it, so without this, a new poke lid list for
  // a different prefecture (navigating between two prefectures without
  // fully unmounting) wouldn't load. `collections` itself no longer needs
  // this — it's shared context, patched in place by every mutation call
  // site (7-6), so a lid collected on the detail screen already shows here
  // via the collectedIds useMemo below with no refetch.
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadPrefectureData()
        .then((result) => {
          if (cancelled) return;
          setLids(result.lids);
          setGuestIds(result.guestIds);
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
      // login/logout and that's exactly when guest-merge data needs to be
      // refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, loadPrefectureData]),
  );

  // Explicit refresh (7-6's own "明示的な更新手段では再取得すること") — also
  // re-fetches the shared collections context, unlike the focus effect above.
  function onRefresh() {
    setLoading(true);
    Promise.all([refreshCollections(), loadPrefectureData()])
      .then(([, result]) => {
        setLids(result.lids);
        setGuestIds(result.guestIds);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const collectedIds = useMemo(
    () => new Set([...collections.map((c) => c.pokeLidId), ...guestIds]),
    [collections, guestIds],
  );

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

  // 7-5: grouped by municipality rather than one flat grid — "西宮市 3/4"
  // is what makes "あと1つ" findable at a glance in a 58-item prefecture.
  // Sorted alphabetically (not by "closest to complete") because this is a
  // browsing view, not a motivational shelf — that's the home screen's job
  // (see index.tsx's "もう少しで達成" section), and an alphabetical order is
  // the more predictable one to scan or search within.
  //
  // All lids here already belong to this one prefecture (fetched via
  // fetchPokeLids(prefectureId)), so grouping by the bare `municipality`
  // string is safe — the prefectureId+municipality uniqueness concern
  // (municipalityKey in packages/shared) only matters when comparing across
  // prefectures, which never happens on this screen.
  const sections = useMemo(() => {
    const groups = new Map<string, PokeLidDto[]>();
    for (const lid of visibleLids) {
      const list = groups.get(lid.municipality);
      if (list) list.push(lid);
      else groups.set(lid.municipality, [lid]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'ja'))
      .map(([municipality, items]) => ({
        title: municipality,
        // total excludes retired lids, same rule as everywhere else
        // (packages/shared's countsTowardProgress) — collected does not, so
        // a retired-but-collected lid still counts toward "3/4" here.
        total: items.filter((l) => countsTowardProgress(l.retiredAt)).length,
        collected: items.filter((l) => collectedIds.has(l.id)).length,
        data: chunkIntoRows(items, columns),
      }));
  }, [visibleLids, collectedIds, columns]);

  // Whole-prefecture state, independent of the "未収集のみ" filter above —
  // `sections` being empty means either "genuinely nothing left to show
  // under the current filter" (complete) or "this prefecture has zero
  // visitable poke lids at all" (no-lids, e.g. 群馬・山梨・広島・熊本・大分),
  // and those need different empty-state copy (see EmptyState below). Same
  // total/collected rule as buildCollectionSummary's own `prefecture` field:
  // total excludes retired lids, collected does not.
  const completionState = useMemo(
    () =>
      classifyCompletion(
        lids.filter((l) => countsTowardProgress(l.retiredAt)).length,
        lids.filter((l) => collectedIds.has(l.id)).length,
      ),
    [lids, collectedIds],
  );

  return (
    <ScreenContainer>
      <Head>
        <title>{prefectureName ? `${prefectureName} - ポケふたコレクト` : 'ポケふたコレクト'}</title>
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
        <SectionList
          sections={sections}
          key={columns}
          keyExtractor={rowKeyExtractor((item: PokeLidDto) => item.id)}
          refreshing={loading}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
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
          ListEmptyComponent={
            !loading ? (
              completionState === 'no-lids' ? (
                <EmptyState
                  title={
                    prefectureName ? `${prefectureName}にはまだポケふたがありません` : 'ポケふたがありません'
                  }
                  message="新しいポケふたが設置され次第、ここに表示されます。"
                  actionLabel="他の都道府県を見る"
                  onAction={() => router.push('/')}
                />
              ) : (
                <EmptyState
                  title={prefectureName ? `${prefectureName}をコンプリート！` : 'コンプリートしました！'}
                  message="他の都道府県にもポケふたが待っています。"
                  actionLabel="他の都道府県を見る"
                  // "次の都道府県へ"（達成率が最も低い県など、具体的な1件へ直接
                  // 飛ばす）も考えたが、それには全都道府県分の進捗を追加取得する
                  // 必要があり、この画面は今その1県分のデータしか持っていない。
                  // 一覧に戻せばどのみち各県の達成率バッジが並んでいて自分で選べ
                  // るので、まずは一覧に戻す形にした。
                  onAction={() => router.push('/')}
                />
              )
            ) : null
          }
          renderSectionHeader={({ section }) => {
            const remaining = section.total - section.collected;
            return (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={[styles.sectionCount, remaining === 1 && styles.sectionCountAlmost]}>
                  {remaining === 0 ? 'コンプリート✓' : `${section.collected}/${section.total}`}
                </Text>
              </View>
            );
          }}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((item, index) => {
                if (item === null) {
                  return <View key={`placeholder-${index}`} style={styles.placeholder} />;
                }
                const collected = collectedIds.has(item.id);
                const retired = item.retiredAt != null;
                return (
                  <PokeLidCard
                    key={item.id}
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
              })}
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.sm },
  row: { flexDirection: 'row' },
  // Matches PokeLidCard's own outer flex/padding so a trailing placeholder
  // cell takes up exactly as much row width as a real card would.
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  filterRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  sectionTitle: { ...typography.bodyMedium },
  sectionCount: { ...typography.footnote, fontWeight: '600', color: colors.textSecondary },
  // "あと1つ" (7-5) — the one count worth calling out visually while
  // scanning a 58-item prefecture for something achievable today. `attention`
  // (7-6) rather than `accent`, since this is a low-urgency nudge, not the
  // screen's primary action.
  sectionCountAlmost: { color: colors.attention },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
});
