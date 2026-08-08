import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type PhotoMedal, type PokeLidDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { CelebrationModal } from '../../src/components/CelebrationModal';
import { ErrorState } from '../../src/components/ErrorState';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import POKE_LIDS from '../../src/data/poke-lids.json';
import {
  ApiError,
  deleteCollection,
  deleteCollectionPhoto,
  fetchMyCollections,
  fetchPokeLid,
  fetchPrefectureProgress,
  photoUrl,
  setPrimaryPhoto,
  updateCollectionNotes,
  uploadCollection,
} from '../../src/lib/api';
import type { CollectionSummary } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { confirmAsync } from '../../src/lib/confirm';
import { formatDateJST } from '../../src/lib/date';
import {
  getGuestCollection,
  removeGuestCollected,
  setGuestCollected,
  type GuestCollection,
} from '../../src/lib/guestStorage';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import { MEDAL_BADGE_COLOR, MEDAL_LABEL } from '../../src/lib/medal';
import { showToast } from '../../src/lib/toast';
import { colors, radius, spacing, typography } from '../../src/theme';

// Round-number milestones for the "N箇所達成" celebration. Starting with a
// handful of well-spaced values (not every 10) so it stays a genuine treat
// rather than firing constantly — tune this list based on how it actually
// feels in use.
const MILESTONE_COUNTS = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450];

// Evaluated in Node.js at build time, once per `expo export`. Without this,
// `web.output: "static"` only ever generates one literal
// `poke-lids/[id].html` file, so every real request for e.g.
// `/poke-lids/<uuid>` falls through to the SPA fallback (the *home* page's
// prerendered HTML) instead of this route's. See
// https://docs.expo.dev/router/web/static-rendering/#dynamic-routes.
//
// Reads from the bundled JSON snapshot (src/data/poke-lids.json) rather than
// fetching from the API: `expo export` can run in environments (CI, a plain
// Docker build) where the API isn't reachable, and poke lid data is static
// enough that a checked-in snapshot — regenerated via
// `npm run dump-poke-lids --workspace=@pokelids/api` after each ETL re-scrape
// — is an acceptable staleness trade-off. This also lets the component below
// use the same data as its synchronous initial state, so the per-lid
// <title>/<meta description> are baked into the static HTML instead of only
// appearing after the client-side fetch resolves.
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return POKE_LIDS.map((l) => ({ id: l.id }));
}

export default function PokeLidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const staticLid = (POKE_LIDS as PokeLidDto[]).find((l) => l.id === id) ?? null;
  const [lid, setLid] = useState<PokeLidDto | null>(staticLid);
  const [collection, setCollection] = useState<CollectionSummary | null>(null);
  const [guestCollection, setGuestCollectionState] = useState<GuestCollection | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The specific photo currently being deleted or promoted, so only that
  // photo's buttons show a busy state / get disabled — not the whole row.
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [celebration, setCelebration] = useState<{ medal: PhotoMedal; milestone: string | null } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLid(id), fetchMyCollections(), getGuestCollection(id)])
      .then(([lidRes, collectionsRes, guestRes]) => {
        if (cancelled) return;
        setLid(lidRes);
        const existingCollection = collectionsRes.find((c) => c.pokeLidId === id) ?? null;
        setCollection(existingCollection);
        setGuestCollectionState(guestRes);
        // Prefer the account's own saved notes; the guest-storage note (if
        // any) is only relevant before the record has synced to an account.
        const existingNotes = existingCollection?.notes ?? guestRes?.notes;
        if (existingNotes) setNotes(existingNotes);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user, reloadKey]);

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
    } catch (err) {
      // Validation rejections (e.g. notes too long) carry a specific
      // Japanese message from the server; anything else falls back to a
      // generic one.
      showToast('エラー', err instanceof ApiError ? err.message : 'メモの保存に失敗しました');
    } finally {
      setSavingNotes(false);
    }
  }

  async function onPickAndUpload(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast('権限が必要です', 'カメラへのアクセス許可が必要です');
        return;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('権限が必要です', '写真ライブラリへのアクセス許可が必要です');
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
          } else if (MILESTONE_COUNTS.includes(progress.collectedCount)) {
            milestone = `${progress.collectedCount}箇所達成！`;
          }
        }
        setCelebration({ medal: uploaded.medal, milestone });
      }
    } catch (err) {
      // Upload-limit rejections (400/413) carry a specific Japanese message
      // from the server; anything else (network failure, etc.) falls back
      // to a generic one.
      showToast('エラー', err instanceof ApiError ? err.message : 'アップロードに失敗しました');
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
      showToast('エラー', '削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  }

  async function onDeletePhoto(photoId: string) {
    if (!collection) return;
    const confirmed = await confirmAsync('写真を削除', 'この写真を削除します。よろしいですか？', '削除する');
    if (!confirmed) return;
    setPhotoActionId(photoId);
    try {
      const photos = await deleteCollectionPhoto(collection.id, photoId);
      setCollection({ ...collection, photos });
    } catch (err) {
      showToast('エラー', err instanceof ApiError ? err.message : '写真の削除に失敗しました');
    } finally {
      setPhotoActionId(null);
    }
  }

  async function onSetPrimaryPhoto(photoId: string) {
    if (!collection) return;
    setPhotoActionId(photoId);
    try {
      const photos = await setPrimaryPhoto(collection.id, photoId);
      setCollection({ ...collection, photos });
    } catch (err) {
      showToast('エラー', err instanceof ApiError ? err.message : '主写真の変更に失敗しました');
    } finally {
      setPhotoActionId(null);
    }
  }

  if (!lid) {
    return (
      <ScreenContainer style={error ? { alignItems: 'center', justifyContent: 'center' } : undefined}>
        <Head>
          <title>ポケふた収集</title>
        </Head>
        {error && <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />}
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
          {lid.retiredAt != null && (
            <View style={styles.retiredNotice}>
              <Text style={styles.retiredNoticeText}>
                このポケふたは撤去され、現地では見られなくなりました
              </Text>
            </View>
          )}
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
              <Text style={styles.collectedLabel}>✓ 収集済み（{formatDateJST(collection.visitedAt)}）</Text>
              <ScrollView horizontal style={styles.photoRow}>
                {collection.photos.map((p) => (
                  <View key={p.id} style={styles.photoThumbWrapper}>
                    <Image
                      source={{ uri: photoUrl(p.thumbUrl) }}
                      style={styles.photoThumb}
                      accessibilityLabel={`${lid.municipality}で撮影した写真`}
                    />
                    <Pressable
                      onPress={() => onSetPrimaryPhoto(p.id)}
                      disabled={p.isPrimary || photoActionId === p.id}
                      accessibilityRole="button"
                      accessibilityLabel={p.isPrimary ? '主写真' : 'この写真を主写真にする'}
                      hitSlop={6}
                      style={styles.primaryToggle}
                    >
                      <Text style={styles.primaryToggleText}>{p.isPrimary ? '★' : '☆'}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDeletePhoto(p.id)}
                      disabled={photoActionId === p.id}
                      accessibilityRole="button"
                      accessibilityLabel="この写真を削除"
                      hitSlop={6}
                      style={styles.photoDeleteButton}
                    >
                      <Text style={styles.photoDeleteButtonText}>✕</Text>
                    </Pressable>
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
              ✓ 収集済み（{formatDateJST(guestCollection.visitedAt)}・端末に保存中）
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
  retiredNotice: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  retiredNoticeText: { ...typography.footnote, color: colors.textSecondary, fontWeight: '600' },
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
  primaryToggle: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryToggleText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  photoDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDeleteButtonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
});
