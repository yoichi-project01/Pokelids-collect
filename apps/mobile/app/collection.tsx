import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { ListRow } from '../src/components/ListRow';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, photoUrl } from '../src/lib/api';
import type { CollectionSummary } from '../src/lib/api';
import { colors, typography } from '../src/theme';

const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

export default function CollectionScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [lidsById, setLidsById] = useState<Map<string, PokeLidDto>>(new Map());

  useEffect(() => {
    Promise.all([fetchMyCollections(), fetchPokeLids()]).then(([collectionsRes, lidsRes]) => {
      setCollections(collectionsRes);
      setLidsById(new Map(lidsRes.map((l) => [l.id, l])));
    });
  }, []);

  return (
    <ScreenContainer>
      <FlatList
        data={collections}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.empty}>まだ収集記録がありません</Text>}
        renderItem={({ item }) => {
          const lid = lidsById.get(item.pokeLidId);
          const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
          const subtitle =
            new Date(item.visitedAt).toLocaleDateString('ja-JP') + (item.notes ? `・${item.notes}` : '');
          return (
            <ListRow
              title={lid?.municipality ?? '（不明）'}
              subtitle={subtitle}
              imageUri={primaryPhoto ? photoUrl(primaryPhoto.id) : null}
              onPress={() => lid && router.push(`/poke-lids/${lid.id}`)}
              right={
                primaryPhoto && primaryPhoto.medal !== 'NONE' ? (
                  <Text style={styles.medal}>{MEDAL_EMOJI[primaryPhoto.medal]}</Text>
                ) : undefined
              }
            />
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  empty: { ...typography.caption, textAlign: 'center', color: colors.textTertiary, marginTop: 40 },
  medal: { fontSize: 20 },
});
