import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, SectionList, StyleSheet, Text, View } from 'react-native';
import {
  aggregatePokemonCounts,
  aggregatePrefectures,
  progressPercent,
  regionNameJa,
  type PokemonAggregate,
  type PrefectureAggregate,
} from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/lib/auth';
import { useCollections } from '../../src/lib/collections';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import { POKE_LIDS } from '../../src/lib/pokeLidsData';
import { colors, spacing, typography } from '../../src/theme';

// 入力のたびに549件を再フィルタするのは避けたい、というほどの重さでは
// ないが、日本語入力（IME確定前の変換途中の状態）でも毎打鍵で一覧が
// ちらつかないよう、他の画面のAPI呼び出しに合わせた粒度感で300msだけ
// 待つ。ネットワークは絡まない（POKE_LIDSはバンドル済み）ので、この
// デバウンスは純粋にUXのためのもの。
const SEARCH_DEBOUNCE_MS = 300;

type PokedexView = 'pokemon' | 'prefecture';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ホームの都道府県一覧（削除済み）が使っていたのと同じ、地域ごとに
// 連続する行をまとめる素朴なグルーピング。PREFECTURES は既に地域順
// （北海道→東北→…→九州・沖縄）に並んでいるため、隣接する要素の地域名が
// 同じかどうかだけを見れば十分で、Map によるグルーピングは不要。
function groupByRegion(prefectures: PrefectureAggregate[]) {
  const sections: { title: string; total: number; collected: number; data: PrefectureAggregate[] }[] = [];
  for (const pref of prefectures) {
    const title = regionNameJa(pref.region);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(pref);
      last.total += pref.total;
      last.collected += pref.collected;
    } else {
      sections.push({ title, total: pref.total, collected: pref.collected, data: [pref] });
    }
  }
  return sections;
}

export default function PokedexScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { collections, refresh: refreshCollections } = useCollections();
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [view, setView] = useState<PokedexView>('pokemon');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);

  // POKE_LIDS はバンドル済みJSON（7-7）、collections は共有Context（7-6）
  // なのでここで取得が要るのはゲストのローカル収集記録（AsyncStorage）
  // だけ — どちらもネットワーク往復ではない。
  const loadGuestIds = useCallback(() => getGuestCollectedIds(), []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadGuestIds()
        .then((ids) => {
          if (cancelled) return;
          setGuestIds(ids);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, loadGuestIds]),
  );

  function onRefresh() {
    setLoading(true);
    Promise.all([refreshCollections(), loadGuestIds()])
      .then(([, ids]) => {
        setGuestIds(ids);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const collectedIds = useMemo(
    () => new Set([...collections.map((c) => c.pokeLidId), ...guestIds]),
    [collections, guestIds],
  );

  const pokemonList = useMemo(() => aggregatePokemonCounts(POKE_LIDS, collectedIds), [collectedIds]);
  const filteredPokemonList = useMemo(() => {
    if (!debouncedSearch) return pokemonList;
    return pokemonList.filter((p) => p.name.includes(debouncedSearch));
  }, [pokemonList, debouncedSearch]);

  const prefectureSections = useMemo(
    () => groupByRegion(aggregatePrefectures(POKE_LIDS, collectedIds)),
    [collectedIds],
  );

  return (
    <ScreenContainer>
      <Head>
        <title>図鑑 - ポケふたコレクト</title>
      </Head>
      <View style={styles.toggleRow}>
        <FilterChip label="ポケモン別" selected={view === 'pokemon'} onPress={() => setView('pokemon')} />
        <FilterChip
          label="都道府県別"
          selected={view === 'prefecture'}
          onPress={() => setView('prefecture')}
        />
      </View>
      {error ? (
        <ErrorState onRetry={onRefresh} />
      ) : view === 'pokemon' ? (
        <FlatList
          data={filteredPokemonList}
          keyExtractor={(item) => item.name}
          refreshing={loading}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <TextField
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="ポケモン名で検索"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.searchField}
              accessibilityLabel="ポケモン名で検索"
            />
          }
          ListEmptyComponent={
            !loading ? (
              debouncedSearch ? (
                <EmptyState
                  title="見つかりませんでした"
                  message={`「${debouncedSearch}」に一致するポケモンがいません。`}
                  actionLabel="検索条件をクリア"
                  onAction={() => setSearchInput('')}
                />
              ) : null
            ) : null
          }
          renderItem={({ item }: { item: PokemonAggregate }) => (
            <ListRow
              title={item.name}
              onPress={() => router.push(`/pokemon/${encodeURIComponent(item.name)}`)}
              right={
                <View style={styles.rowProgress}>
                  <ProgressBar total={item.total} collected={item.collected} />
                </View>
              }
            />
          )}
        />
      ) : (
        <SectionList
          sections={prefectureSections}
          keyExtractor={(item) => String(item.prefectureId)}
          refreshing={loading}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionPercent}>{progressPercent(section.collected, section.total)}%</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ListRow
              title={item.nameJa}
              imageUri={item.imageUrl}
              onPress={() => router.push(`/prefectures/${item.prefectureId}`)}
              right={
                <View style={styles.rowProgress}>
                  <ProgressBar total={item.total} collected={item.collected} />
                </View>
              }
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  listContent: { paddingBottom: spacing.xl },
  searchField: { marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: { ...typography.caption, textTransform: 'uppercase' },
  sectionPercent: { ...typography.footnote, fontWeight: '600', color: colors.accent },
  // flex: 1 with min/max caps instead of a fixed width: 320px screens need
  // the bar to shrink so it doesn't crowd the name, and wide web screens
  // shouldn't stretch it into a thin sliver (index.tsx's old prefecture
  // section made the same call).
  rowProgress: { flex: 1, maxWidth: 160, minWidth: 80 },
});
