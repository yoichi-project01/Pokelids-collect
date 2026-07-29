import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLids } from '../../src/lib/api';
import { getGuestCollectedIds } from '../../src/lib/guestStorage';

export default function PrefecturePokeLidsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lids, setLids] = useState<PokeLidDto[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [id]);

  return (
    <FlatList
      data={lids}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const collected = collectedIds.has(item.id);
        return (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/poke-lids/${item.id}`)}>
            {item.officialImageUrl && (
              <Image source={{ uri: item.officialImageUrl }} style={styles.thumb} />
            )}
            <View style={styles.info}>
              <Text style={styles.municipality}>{item.municipality}</Text>
              <Text style={styles.pokemon}>{item.pokemonFeatured.join('・')}</Text>
            </View>
            <Text style={collected ? styles.collected : styles.notCollected}>
              {collected ? '✓ 収集済み' : '未収集'}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#f2f2f2' },
  info: { flex: 1 },
  municipality: { fontSize: 16, fontWeight: '600' },
  pokemon: { fontSize: 13, color: '#777' },
  collected: { color: '#2e8b57', fontWeight: '600' },
  notCollected: { color: '#aaa' },
});
