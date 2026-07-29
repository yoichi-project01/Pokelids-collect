import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type PhotoMedal, type PokeLidDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { CelebrationModal } from '../../src/components/CelebrationModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import {
  deleteCollection,
  fetchMyCollections,
  fetchPokeLid,
  fetchPrefectureProgress,
  photoUrl,
  updateCollectionNotes,
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
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
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
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [celebration, setCelebration] = useState<{ medal: PhotoMedal; milestone: string | null } | null>(
    null,
  );

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLid(id), fetchMyCollections(), getGuestCollection(id)]).then(
      ([lidRes, collectionsRes, guestRes]) => {
        if (cancelled) return;
        setLid(lidRes);
        const existingCollection = collectionsRes.find((c) => c.pokeLidId === id) ?? null;
        setCollection(existingCollection);
        setGuestCollectionState(guestRes);
        // Prefer the account's own saved notes; the guest-storage note (if
        // any) is only relevant before the record has synced to an account.
        const existingNotes = existingCollection?.notes ?? guestRes?.notes;
        if (existingNotes) setNotes(existingNotes);
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

  async function onSaveNotes() {
    if (!collection) return;
    setSavingNotes(true);
    try {
      await updateCollectionNotes(collection.id, notes || null);
      setCollection({ ...collection, notes: notes || null });
    } catch {
      Alert.alert('エラー', 'メモの保存に失敗しました');
    } finally {
      setSavingNotes(false);
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
    if (result.canceled || !lid) return;

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

      if (uploaded.medal) {
        const progress = await fetchPrefectureProgress().catch(() => null);
        let milestone: string | null = null;
        if (progress) {
          const pref = progress.byPrefecture.find((p) => p.prefectureId === lid.prefectureId);
          if (pref && pref.total > 0 && pref.collected === pref.total) {
            milestone = `${pref.nameJa}コンプリート！`;
          } else if (progress.collectedCount > 0 && progress.collectedCount % 10 === 0) {
            milestone = `${progress.collectedCount}箇所達成！`;
          }
        }
        setCelebration({ medal: uploaded.medal, milestone });
      }
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

  const distanceKm = location
    ? haversineDistanceMeters(location.latitude, location.longitude, lid.latitude, lid.longitude) / 1000
    : null;

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
        {lid.officialImageUrl && (
          <Image source={{ uri: lid.officialImageUrl }} style={styles.image} accessibilityLabel={lid.name} />
        )}
        <View style={styles.card}>
          <Text style={styles.title}>{lid.municipality}</Text>
          <Text style={styles.pokemon}>{lid.pokemonFeatured.join('・')}</Text>
          <Text style={styles.address}>{lid.address}</Text>
          {distanceKm !== null && <Text style={styles.distance}>現在地から {distanceKm.toFixed(1)}km</Text>}
          <Button
            title="経路案内を開く"
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/dir/?api=1&destination=${lid.latitude},${lid.longitude}`,
              )
            }
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
                    <Image
                      source={{ uri: photoUrl(p.thumbUrl) }}
                      style={styles.photoThumb}
                      accessibilityLabel={`${lid.municipality}で撮影した写真`}
                    />
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
          {user && collection && (
            <Button
              title={savingNotes ? '保存中…' : 'メモを保存'}
              onPress={onSaveNotes}
              loading={savingNotes}
              variant="secondary"
            />
          )}

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
      <CelebrationModal
        visible={celebration !== null}
        medal={celebration?.medal ?? null}
        milestone={celebration?.milestone ?? null}
        onClose={() => setCelebration(null)}
      />
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
  distance: { ...typography.footnote, color: colors.accent, fontWeight: '600' },
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
