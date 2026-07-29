import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PokeLidDto } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLid, photoUrl, uploadCollection } from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';

export default function PokeLidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lid, setLid] = useState<PokeLidDto | null>(null);
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPokeLid(id), fetchMyCollections()]).then(([lidRes, collectionsRes]) => {
      if (cancelled) return;
      setLid(lidRes);
      setCollection(collectionsRes.find((c) => c.pokeLidId === id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onPickAndUpload() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !permission.granted) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const uploaded = await uploadCollection({
        pokeLidId: id,
        notes: notes || undefined,
        photoUri: asset.uri,
        photoName: asset.fileName ?? `${id}.jpg`,
        photoType: asset.mimeType ?? 'image/jpeg',
      });
      const updated = await fetchMyCollections();
      setCollection(updated.find((c) => c.pokeLidId === id) ?? null);
      Alert.alert(
        '保存しました',
        uploaded.geoVerified
          ? 'ポケふたを収集済みとして記録しました（位置情報を確認済み）'
          : 'ポケふたを収集済みとして記録しました\n※写真の位置情報が現地と一致しなかったため未確認です',
      );
    } catch {
      Alert.alert('エラー', 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  if (!lid) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {lid.officialImageUrl && <Image source={{ uri: lid.officialImageUrl }} style={styles.image} />}
      <Text style={styles.title}>{lid.municipality}</Text>
      <Text style={styles.pokemon}>{lid.pokemonFeatured.join('・')}</Text>
      <Text style={styles.address}>{lid.address}</Text>
      <Button
        title="Googleマップで開く"
        onPress={() => Linking.openURL(`https://maps.google.com/maps?q=${lid.latitude},${lid.longitude}`)}
      />

      <View style={styles.divider} />

      {collection ? (
        <View>
          <Text style={styles.collectedLabel}>✓ 収集済み（{new Date(collection.visitedAt).toLocaleDateString('ja-JP')}）</Text>
          <ScrollView horizontal style={styles.photoRow}>
            {collection.photos.map((p) => (
              <View key={p.id} style={styles.photoThumbWrapper}>
                <Image source={{ uri: photoUrl(p.id) }} style={styles.photoThumb} />
                <View style={[styles.geoBadge, p.geoVerified ? styles.geoBadgeVerified : styles.geoBadgeUnverified]}>
                  <Text style={styles.geoBadgeText}>{p.geoVerified ? '📍確認済み' : '未確認'}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.notCollectedLabel}>まだ収集していません</Text>
      )}

      <TextInput
        style={styles.notesInput}
        placeholder="メモ（任意）"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Button
        title={uploading ? 'アップロード中…' : '写真を撮って記録する'}
        onPress={onPickAndUpload}
        disabled={uploading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  image: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#f2f2f2' },
  title: { fontSize: 22, fontWeight: 'bold' },
  pokemon: { fontSize: 16, color: '#e3350d' },
  address: { fontSize: 14, color: '#555' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  collectedLabel: { color: '#2e8b57', fontWeight: '600', marginBottom: 8 },
  notCollectedLabel: { color: '#aaa', marginBottom: 8 },
  photoRow: { flexDirection: 'row' },
  photoThumbWrapper: { marginRight: 8 },
  photoThumb: { width: 100, height: 100, borderRadius: 8 },
  geoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  geoBadgeVerified: { backgroundColor: 'rgba(46, 139, 87, 0.85)' },
  geoBadgeUnverified: { backgroundColor: 'rgba(153, 153, 153, 0.85)' },
  geoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  notesInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
