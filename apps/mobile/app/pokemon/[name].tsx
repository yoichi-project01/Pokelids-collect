import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { isPokeLidVisible, type PokeLidDto } from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { useAuth } from '../../src/lib/auth';
import { useCollections } from '../../src/lib/collections';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import { POKE_LIDS } from '../../src/lib/pokeLidsData';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function PokemonPokeLidsScreen() {
  const { name: rawName } = useLocalSearchParams<{ name: string }>();
  // decodeURIComponent is a no-op on an already-decoded string (no literal
  // "%" in any real pokemon name), so this is safe regardless of whether
  // expo-router has already decoded the segment itself — see pokedex.tsx's
  // own encodeURIComponent when building this route's href.
  const name = decodeURIComponent(rawName ?? '');
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { collections } = useCollections();
  const [guestIds, setGuestIds] = useState<Set<string>>(new Set());
  const columns = useResponsiveColumns();

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      getGuestCollectedIds().then((ids) => {
        if (!cancelled) setGuestIds(ids);
      });
      return () => {
        cancelled = true;
      };
      // `user` isn't read in the body, but its identity changes on
      // login/logout and that's exactly when guest-merge data needs to be
      // refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user]),
  );

  const collectedIds = useMemo(
    () => new Set([...collections.map((c) => c.pokeLidId), ...guestIds]),
    [collections, guestIds],
  );

  // POKE_LIDS はバンドル済み(7-7)、collectedIds もネットワーク不要な
  // ソース（共有Context＋ローカルストレージ）から組み立てているため、
  // この画面自体はAPI往復を一切発生させない。
  const lids = useMemo(
    () =>
      POKE_LIDS.filter(
        (l) => l.pokemonFeatured.includes(name) && isPokeLidVisible(l.retiredAt, collectedIds.has(l.id)),
      ),
    [name, collectedIds],
  );
  const gridData = useGridData(lids, columns);
  const collectedCount = lids.filter((l) => collectedIds.has(l.id)).length;

  return (
    <ScreenContainer>
      <Head>
        <title>{name ? `${name} - ポケふたコレクト` : 'ポケふたコレクト'}</title>
        {name && (
          <meta
            name="description"
            content={`${name}が描かれたポケふた(ご当地ポケモンマンホール)の一覧。訪問して収集記録を残そう。`}
          />
        )}
      </Head>
      <FlatList
        data={gridData}
        key={columns}
        numColumns={columns}
        keyExtractor={gridKeyExtractor((item: PokeLidDto) => item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          lids.length > 0 ? (
            <View style={styles.headerRow}>
              <Text style={styles.headerText}>
                {name} {collectedCount}/{lids.length} 箇所
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            title="ポケふたが見つかりません"
            message="このポケモンが描かれたポケふたは見つかりませんでした。"
            actionLabel="図鑑に戻る"
            onAction={() => router.push('/pokedex')}
          />
        }
        renderItem={({ item }) => {
          if (item === null) return <View style={styles.placeholder} />;
          return (
            <PokeLidCard
              title={item.municipality}
              subtitle={item.pokemonFeatured.join('・')}
              imageUri={item.officialImageUrl}
              collected={collectedIds.has(item.id)}
              badge={
                item.retiredAt != null ? (
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.sm },
  headerRow: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  headerText: { ...typography.bodyMedium },
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
});
