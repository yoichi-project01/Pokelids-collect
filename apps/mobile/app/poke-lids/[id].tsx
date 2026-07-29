import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import type { PhotoMedal, PokeLidDto } from '@pokelids/shared';
import { fetchMyCollections, fetchPokeLid, photoUrl, uploadCollection } from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import {
  getGuestCollection,
  removeGuestCollected,
  setGuestCollected,
  type GuestCollection,
} from '../../src/lib/guestStorage';
import { MEDAL_BADGE_COLOR, MEDAL_LABEL } from '../../src/lib/medal';

export default function PokeLidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [lid, setLid] = useState<PokeLidDto | null>(null);
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [guestCollection, setGuestCollectionState] = useState<GuestCollection | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLid(id), fetchMyCollections(), getGuestCollection(id)]).then(
      ([lidRes, collectionsRes, guestRes]) => {
        if (cancelled) return;
        setLid(lidRes);
        setCollection(collectionsRes.find((c) => c.pokeLidId === id) ?? null);
        setGuestCollectionState(guestRes);
        if (guestRes?.notes) setNotes(guestRes.notes);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user]);

  async function onMarkGuestVisited() {
    setSavingGuest(true);
    try {
      await setGuestCollected(id, notes || null);
      setGuestCollectionState(await getGuestCollection(id));
    } finally {
      setSavingGuest(false);
    }
  }

  async function onRemoveGuestVisited() {
    setSavingGuest(true);
    try {
      await removeGuestCollected(id);
      setGuestCollectionState(null);
    } finally {
      setSavingGuest(false);
    }
  }

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
      const medalMessage: Record<PhotoMedal, string> = {
        GOLD: 'ポケふたを収集済みとして記録しました🥇（写真の位置情報が一致しました）',
        SILVER: 'ポケふたを収集済みとして記録しました🥈（写真に位置情報がありませんでした）',
        NONE: 'ポケふたを収集済みとして記録しました\n※写真の位置情報が現地と一致しませんでした',
      };
      Alert.alert('保存しました', uploaded.medal ? medalMessage[uploaded.medal] : '保存しました');
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

      {user && collection ? (
        <View>
          <Text style={styles.collectedLabel}>✓ 収集済み（{new Date(collection.visitedAt).toLocaleDateString('ja-JP')}）</Text>
          <ScrollView horizontal style={styles.photoRow}>
            {collection.photos.map((p) => (
              <View key={p.id} style={styles.photoThumbWrapper}>
                <Image source={{ uri: photoUrl(p.id) }} style={styles.photoThumb} />
                <View style={[styles.geoBadge, { backgroundColor: MEDAL_BADGE_COLOR[p.medal] }]}>
                  <Text style={styles.geoBadgeText}>{MEDAL_LABEL[p.medal]}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : !user && guestCollection ? (
        <Text style={styles.collectedLabel}>
          ✓ 収集済み（{new Date(guestCollection.visitedAt).toLocaleDateString('ja-JP')}・端末に保存中）
        </Text>
      ) : (
        <Text style={styles.notCollectedLabel}>まだ収集していません</Text>
      )}

      {user ? (
        <>
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
        </>
      ) : (
        <>
          <TextInput
            style={styles.notesInput}
            placeholder="メモ（任意）"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          {guestCollection ? (
            <Button
              title={savingGuest ? '処理中…' : '端末保存の記録を取り消す'}
              onPress={onRemoveGuestVisited}
              disabled={savingGuest}
              color="#999"
            />
          ) : (
            <Button
              title={savingGuest ? '保存中…' : '訪問済みにする（端末に保存）'}
              onPress={onMarkGuestVisited}
              disabled={savingGuest}
            />
          )}
          <Text style={styles.guestHint}>
            写真の追加やアカウントへの保存にはログインが必要です
          </Text>
          <Button title="ログインする" onPress={() => router.push('/login')} />
        </>
      )}
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
  guestHint: { fontSize: 12, color: '#e3350d', textAlign: 'center' },
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
