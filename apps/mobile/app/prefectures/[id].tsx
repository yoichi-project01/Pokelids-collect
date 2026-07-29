import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { ListRow } from '../../src/components/ListRow';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';
import { colors, typography } from '../../src/theme';

export default function PrefecturePokeLidsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [lids, setLids] = useState<PokeLidDto[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLids(Number(id)), fetchMyCollections(), getGuestCollectedIds()]).then(
      ([lidsRes, collectionsRes, guestIds]) => {
        if (cancelled) return;
        setLids(lidsRes);
        setCollectedIds(new Set([...collectionsRes.map((c) => c.pokeLidId), ...guestIds]));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user]);

  return (
    <ScreenContainer>
      <FlatList
        data={lids}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        renderItem={({ item }) => {
          const collected = collectedIds.has(item.id);
          return (
            <ListRow
              title={item.municipality}
              subtitle={item.pokemonFeatured.join('・')}
              imageUri={item.officialImageUrl}
              onPress={() => router.push(`/poke-lids/${item.id}`)}
              right={
                <Text style={collected ? styles.collected : styles.notCollected}>
                  {collected ? '✓ 収集済み' : '未収集'}
                </Text>
              }
            />
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  collected: { ...typography.footnote, color: colors.textPrimary, fontWeight: '600' },
  notCollected: { ...typography.footnote, color: colors.textTertiary },
});
