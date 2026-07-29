import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLids, photoUrl } from '../src/lib/api';
import type { CollectionSummary } from '../src/lib/api';

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
    <FlatList
      data={collections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>まだ収集記録がありません</Text>}
      renderItem={({ item }) => {
        const lid = lidsById.get(item.pokeLidId);
        const primaryPhoto = item.photos.find((p) => p.isPrimary) ?? item.photos[0];
        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => lid && router.push(`/poke-lids/${lid.id}`)}
          >
            {primaryPhoto && (
              <View style={styles.thumbWrapper}>
                <Image source={{ uri: photoUrl(primaryPhoto.id) }} style={styles.thumb} />
                {primaryPhoto.medal !== 'NONE' && (
                  <Text style={styles.medalBadge}>{MEDAL_EMOJI[primaryPhoto.medal]}</Text>
                )}
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.municipality}>{lid?.municipality ?? '（不明）'}</Text>
              <Text style={styles.date}>{new Date(item.visitedAt).toLocaleDateString('ja-JP')}</Text>
              {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 8 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
  },
  thumbWrapper: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#f2f2f2' },
  medalBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 18,
  },
  info: { flex: 1 },
  municipality: { fontSize: 16, fontWeight: '600' },
  date: { fontSize: 12, color: '#999' },
  notes: { fontSize: 13, color: '#555', marginTop: 2 },
});
