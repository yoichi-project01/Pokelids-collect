import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, fetchPrefectureProgress } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import { colors, spacing, typography } from '../../src/theme';

const GRID_COLUMNS = 3;

export default function PrefecturePokeLidsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [lids, setLids] = useState<PokeLidDto[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [prefectureName, setPrefectureName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uncollectedOnly, setUncollectedOnly] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([
      fetchPokeLids(Number(id)),
      fetchMyCollections(),
      getGuestCollectedIds(),
      fetchPrefectureProgress(),
    ]).then(([lidsRes, collectionsRes, guestIds, progress]) => {
      if (cancelled) return;
      setLids(lidsRes);
      setCollectedIds(new Set([...collectionsRes.map((c) => c.pokeLidId), ...guestIds]));
      setPrefectureName(progress.byPrefecture.find((p) => p.prefectureId === Number(id))?.nameJa ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user]);

  const visibleLids = useMemo(
    () => (uncollectedOnly ? lids.filter((l) => !collectedIds.has(l.id)) : lids),
    [lids, collectedIds, uncollectedOnly],
  );

  return (
    <ScreenContainer>
      <Head>
        <title>{prefectureName ? `${prefectureName} - ポケふた収集` : 'ポケふた収集'}</title>
      </Head>
      <FlatList
        data={visibleLids}
        key={GRID_COLUMNS}
        numColumns={GRID_COLUMNS}
        keyExtractor={(item) => item.id}
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
          const collected = collectedIds.has(item.id);
          return (
            <PokeLidCard
              title={item.municipality}
              subtitle={item.pokemonFeatured.join('・')}
              imageUri={item.officialImageUrl}
              collected={collected}
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
});
