import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PhotoMedal, PokeLidDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import {
  deleteCollection,
  fetchMyCollections,
  fetchPokeLid,
  photoUrl,
  uploadCollection,
} from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { confirmAsync } from '../../src/lib/confirm';
import {
  getGuestCollection,
  removeGuestCollected,
  setGuestCollected,
  type GuestCollection,
} from '../../src/lib/guestStorage';
import { MEDAL_BADGE_COLOR, MEDAL_LABEL } from '../../src/lib/medal';
import { colors, radius, spacing, typography } from '../../src/theme';

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
  const [deleting, setDeleting] = useState(false);

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
    if (!lid) return;
    setSavingGuest(true);
    try {
      await setGuestCollected(id, lid.prefectureId, notes || null);
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

  async function onPickAndUpload(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('権限が必要です', 'カメラへのアクセス許可が必要です');
        return;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('権限が必要です', '写真ライブラリへのアクセス許可が必要です');
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
          });
    if (result.canceled) return;

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

  async function onDeleteCollection() {
    if (!collection) return;
    const confirmed = await confirmAsync(
      '収集記録を削除',
      '写真を含め、この収集記録を削除します。よろしいですか？',
      '削除する',
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteCollection(collection.id);
      setCollection(null);
    } catch {
      Alert.alert('エラー', '削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  }

  if (!lid) {
    return (
      <ScreenContainer>
        <Head>
          <title>ポケふた収集</title>
        </Head>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Head>
        <title>{`${lid.municipality}｜${lid.pokemonFeatured.join('・')} - ポケふた収集`}</title>
        <meta
          name="description"
          content={`${lid.address}にあるポケふた。${lid.pokemonFeatured.join('・')}が描かれています。`}
        />
      </Head>
      <ScrollView contentContainerStyle={styles.container}>
        {lid.officialImageUrl && <Image source={{ uri: lid.officialImageUrl }} style={styles.image} />}
        <View style={styles.card}>
          <Text style={styles.title}>{lid.municipality}</Text>
          <Text style={styles.pokemon}>{lid.pokemonFeatured.join('・')}</Text>
          <Text style={styles.address}>{lid.address}</Text>
          <Button
            title="Googleマップで開く"
            onPress={() => Linking.openURL(`https://maps.google.com/maps?q=${lid.latitude},${lid.longitude}`)}
            variant="secondary"
          />
        </View>

        <View style={styles.card}>
          {user && collection ? (
            <View>
              <Text style={styles.collectedLabel}>
                ✓ 収集済み（{new Date(collection.visitedAt).toLocaleDateString('ja-JP')}）
              </Text>
              <ScrollView horizontal style={styles.photoRow}>
                {collection.photos.map((p) => (
                  <View key={p.id} style={styles.photoThumbWrapper}>
                    <Image source={{ uri: photoUrl(p.thumbUrl) }} style={styles.photoThumb} />
                    <View style={[styles.geoBadge, { backgroundColor: MEDAL_BADGE_COLOR[p.medal] }]}>
                      <Text style={styles.geoBadgeText}>{MEDAL_LABEL[p.medal]}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <Button
                title={deleting ? '削除中…' : 'この記録を削除する'}
                onPress={onDeleteCollection}
                loading={deleting}
                variant="secondary"
              />
            </View>
          ) : !user && guestCollection ? (
            <Text style={styles.collectedLabel}>
              ✓ 収集済み（{new Date(guestCollection.visitedAt).toLocaleDateString('ja-JP')}・端末に保存中）
            </Text>
          ) : (
            <Text style={styles.notCollectedLabel}>まだ収集していません</Text>
          )}

          <TextField
            placeholder="メモ（任意）"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={styles.notesInput}
          />

          {user ? (
            <>
              <Button
                title={uploading ? 'アップロード中…' : '写真を撮って記録する'}
                onPress={() => onPickAndUpload('camera')}
                loading={uploading}
              />
              <Button
                title="ライブラリから選ぶ"
                onPress={() => onPickAndUpload('library')}
                loading={uploading}
                variant="secondary"
              />
            </>
          ) : (
            <>
              {guestCollection ? (
                <Button
                  title="端末保存の記録を取り消す"
                  onPress={onRemoveGuestVisited}
                  loading={savingGuest}
                  variant="secondary"
                />
              ) : (
                <Button
                  title="訪問済みにする（端末に保存）"
                  onPress={onMarkGuestVisited}
                  loading={savingGuest}
                />
              )}
              <Text style={styles.guestHint}>写真の追加やアカウントへの保存にはログインが必要です</Text>
              <Button title="ログインする" onPress={() => router.push('/login')} variant="secondary" />
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  image: { width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { ...typography.title },
  pokemon: { ...typography.caption },
  address: { ...typography.caption, marginBottom: spacing.xs },
  collectedLabel: { ...typography.bodyMedium, marginBottom: spacing.sm },
  notCollectedLabel: { ...typography.caption, marginBottom: spacing.sm },
  guestHint: { ...typography.footnote, color: colors.danger, textAlign: 'center' },
  photoRow: { flexDirection: 'row' },
  photoThumbWrapper: { marginRight: spacing.sm },
  photoThumb: { width: 100, height: 100, borderRadius: radius.sm },
  geoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  geoBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
});
