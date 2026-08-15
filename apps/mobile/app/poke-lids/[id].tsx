import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  computeCelebrationMilestone,
  countsTowardProgress,
  haversineDistanceMeters,
  type CollectionDto,
  type CollectionSummary,
  type PhotoMedal,
  type PokeLidDto,
} from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { CelebrationModal } from '../../src/components/CelebrationModal';
import { ErrorState } from '../../src/components/ErrorState';
import { PhotoPreviewModal } from '../../src/components/PhotoPreviewModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { TextField } from '../../src/components/TextField';
import POKE_LIDS from '../../src/data/poke-lids.json';
import {
  ApiError,
  deleteCollection,
  deleteCollectionPhoto,
  fetchMyCollections,
  fetchPokeLid,
  photoUrl,
  setPrimaryPhoto,
  updateCollectionNotes,
  uploadCollection,
  type UploadPhotoInput,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { confirmAsync } from '../../src/lib/confirm';
import { formatDateJST } from '../../src/lib/date';
import { formatDistanceMeters } from '../../src/lib/formatDistance';
import { captureGuestPhoto } from '../../src/lib/guestPhotoCapture';
import {
  getGuestPhotos,
  removeGuestPhotosFor,
  GuestPhotoLimitError,
  type GuestPhotoWithUri,
} from '../../src/lib/guestPhotoStorage';
import {
  getGuestCollection,
  getGuestCollections,
  removeGuestCollected,
  setGuestCollected,
  type GuestCollection,
} from '../../src/lib/guestStorage';
import { maybeShowInstallPrompt } from '../../src/lib/installPrompt';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import { MEDAL_BADGE_COLOR, MEDAL_LABEL } from '../../src/lib/medal';
import { extractPhotoExif } from '../../src/lib/photoExif';
import { showToast } from '../../src/lib/toast';
import { colors, radius, spacing, typography } from '../../src/theme';

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

// a guest photo's distance is meant to read as "close enough to prove it"
// (the example in 7-9 is "現地から12m") — formatDistanceMeters already gives
// meter precision below 1km for exactly that reason.
function formatPhotoDistance(distanceMeters: number | null): string {
  // !Number.isFinite, not `=== null` alone — validateCoordinates
  // (@pokelids/shared) should already keep NaN out of distanceMeters
  // upstream, but this is the display layer's own backstop against ever
  // rendering "現地からNaNkm" again, whatever produced the bad value.
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) return '位置情報なし';
  return `現地から${formatDistanceMeters(distanceMeters)}`;
}

export default function PokeLidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const staticLid = (POKE_LIDS as PokeLidDto[]).find((l) => l.id === id) ?? null;
  const [lid, setLid] = useState<PokeLidDto | null>(staticLid);
  const [collection, setCollection] = useState<CollectionDto | null>(null);
  const [guestCollection, setGuestCollectionState] = useState<GuestCollection | null>(null);
  // Photos a guest has saved to this device for this poke lid (7-9, phase
  // 1) — separate from `collection.photos` (server-confirmed, with a real
  // medal), never merged into it.
  const [guestPhotos, setGuestPhotos] = useState<GuestPhotoWithUri[]>([]);
  const [notes, setNotes] = useState('');
  // A photo the user just picked (camera or library) but hasn't confirmed
  // yet — see PhotoPreviewModal (4-4). Not uploaded until onConfirmUpload.
  const [pendingPhoto, setPendingPhoto] = useState<
    (UploadPhotoInput & { source: 'camera' | 'library' }) | null
  >(null);
  // The EXIF distance for `pendingPhoto`, read at pick time so
  // PhotoPreviewModal can warn about a likely wrong-poke-lid mix-up before
  // the photo is ever recorded — not the server's (or, for a guest,
  // captureGuestPhoto's) own later, authoritative read. Only informational
  // here, same "client-side reading is advisory, never a promise" stance
  // QUICK_RECORD_RADIUS_METERS's own doc comment takes.
  const [pendingPhotoDistanceMeters, setPendingPhotoDistanceMeters] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // Fraction (0–1), not a percent int — the progress bar below does its own
  // rounding for display so this stays the raw value from the transport.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [savingGuest, setSavingGuest] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The specific photo currently being deleted or promoted, so only that
  // photo's buttons show a busy state / get disabled — not the whole row.
  const [photoActionId, setPhotoActionId] = useState<string | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [celebration, setCelebration] = useState<{
    medal: PhotoMedal;
    milestone: string | null;
    // Which picker produced the photo this celebration is about, so a NONE
    // medal's "もう一度撮影する" button re-launches the same one.
    source: 'camera' | 'library';
    // Drives the "next" section (7-4) inside CelebrationModal.
    summary: CollectionSummary;
  } | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    Promise.all([fetchPokeLid(id), fetchMyCollections(), getGuestCollection(id), getGuestPhotos(id)])
      .then(([lidRes, collectionsRes, guestRes, guestPhotosRes]) => {
        if (cancelled) return;
        setLid(lidRes);
        const existingCollection = collectionsRes.find((c) => c.pokeLidId === id) ?? null;
        setCollection(existingCollection);
        setGuestCollectionState(guestRes);
        setGuestPhotos(guestPhotosRes);
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

  // Checked after every guest record write (both here and
  // onConfirmGuestPhoto below), not on a timer — see maybeShowInstallPrompt
  // for why this needs to be tied to the moment a guest could plausibly
  // have just crossed the 3-record threshold (7-10).
  async function checkInstallPromptAfterGuestRecord() {
    const count = (await getGuestCollections()).length;
    void maybeShowInstallPrompt(count);
  }

  async function onMarkGuestVisited() {
    if (!lid) return;
    setSavingGuest(true);
    try {
      await setGuestCollected(id, lid.prefectureId, notes || null);
      setGuestCollectionState(await getGuestCollection(id));
      void checkInstallPromptAfterGuestRecord();
    } finally {
      setSavingGuest(false);
    }
  }

  async function onRemoveGuestVisited() {
    setSavingGuest(true);
    try {
      // Also clears any locally-saved photos for this poke lid — otherwise
      // they'd keep occupying storage (and counting toward
      // MAX_GUEST_PHOTOS_TOTAL) with no remaining way to reach or remove
      // them individually.
      await Promise.all([removeGuestCollected(id), removeGuestPhotosFor(id)]);
      setGuestCollectionState(null);
      setGuestPhotos([]);
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

  // Opens the camera/library picker and, on success, stops at the preview
  // step (sets pendingPhoto) rather than uploading immediately — a blurry or
  // finger-covered shot used to go straight to the server (4-4).
  async function onPickPhoto(source: 'camera' | 'library') {
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
    if (result.canceled) return;

    const asset = result.assets[0];
    // Read before opening PhotoPreviewModal (not after confirming) so its
    // location-mismatch warning can show immediately, with no flicker —
    // this is a second, independent EXIF read from the one
    // uploadCollection/captureGuestPhoto do later for the real medal/
    // distance; kept separate rather than threaded through so this
    // screen's "preview" and "commit" steps stay as decoupled as
    // PhotoPreviewModal's own design already treats them (4-4).
    const exif = await extractPhotoExif({ uri: asset.uri, webFile: asset.file });
    setPendingPhotoDistanceMeters(
      exif.latitude !== null && exif.longitude !== null && lid
        ? haversineDistanceMeters(exif.latitude, exif.longitude, lid.latitude, lid.longitude)
        : null,
    );
    setPendingPhoto({
      source,
      uri: asset.uri,
      name: asset.fileName ?? `${id}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      // Only present on web — see UploadPhotoInput's doc comment in api.ts.
      webFile: asset.file,
    });
  }

  function onRetakePhoto() {
    const source = pendingPhoto?.source;
    setPendingPhoto(null);
    setPendingPhotoDistanceMeters(null);
    if (source) void onPickPhoto(source);
  }

  function onDismissPreview() {
    setPendingPhoto(null);
    setPendingPhotoDistanceMeters(null);
  }

  async function onConfirmUpload() {
    if (!pendingPhoto || !lid) return;
    const { source, ...photo } = pendingPhoto;
    setPendingPhoto(null);
    setPendingPhotoDistanceMeters(null);

    if (!user) {
      await onConfirmGuestPhoto(photo, lid);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const { collection: updated, summary } = await uploadCollection(
        { pokeLidId: id, notes: notes || undefined, photo },
        setUploadProgress,
      );
      setCollection(updated);

      // The photo this request just added is the newest one — the server
      // always returns `photos` ordered oldest-first (see collections.ts's
      // serializeCollection), so it's the last element.
      const newPhoto = updated.photos[updated.photos.length - 1] ?? null;
      if (newPhoto) {
        // Shared with the map's quick-record flow (6-6) — see its doc
        // comment in packages/shared for the exact priority/guard logic.
        const milestone = computeCelebrationMilestone(summary);
        setCelebration({ medal: newPhoto.medal, milestone, source, summary });
      }
    } catch (err) {
      // Upload-limit rejections (400/413) carry a specific Japanese message
      // from the server; anything else (network failure, etc.) falls back
      // to a generic one.
      showToast('エラー', err instanceof ApiError ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  // Guest path (7-9, phase 1) never touches the server — saves to this
  // device only, via captureGuestPhoto's fixed EXIF-then-resize-then-save
  // pipeline. No upload progress (there's no network transfer) and no
  // CelebrationModal: captureGuestPhoto deliberately never resolves a
  // confirmed medal (only a distance), and celebrating a medal that might
  // read differently once this eventually syncs (phase 2) is exactly the
  // "金メダルだったのに同期後に銀になった" experience this is meant to avoid.
  async function onConfirmGuestPhoto(photo: UploadPhotoInput, currentLid: PokeLidDto) {
    setUploading(true);
    try {
      const saved = await captureGuestPhoto(id, photo, currentLid);
      await setGuestCollected(id, currentLid.prefectureId, notes || null);
      setGuestCollectionState(await getGuestCollection(id));
      setGuestPhotos((prev) => [...prev, saved]);
      showToast('この端末に保存しました', 'ログインすると、他の端末でも見られます', 'success');
      void checkInstallPromptAfterGuestRecord();
    } catch (err) {
      // Limit rejections (5枚/記録・30枚合計・空き容量不足) carry a specific
      // Japanese message from GuestPhotoLimitError; anything else (resize
      // failure, storage write failure) falls back to a generic one.
      showToast('エラー', err instanceof GuestPhotoLimitError ? err.message : '写真の保存に失敗しました');
    } finally {
      setUploading(false);
    }
  }

  function onRetakeFromCelebration() {
    const source = celebration?.source;
    setCelebration(null);
    if (source) void onPickPhoto(source);
  }

  // Tapping the "一番近い未収集のポケふた" suggestion in CelebrationModal —
  // closes this record's celebration and jumps straight to that one (7-4).
  function onNavigateToNext(nextPokeLidId: string) {
    setCelebration(null);
    router.push(`/poke-lids/${nextPokeLidId}`);
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
      const { collection: updated } = await deleteCollectionPhoto(collection.id, photoId);
      setCollection(updated);
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
      const { collection: updated } = await setPrimaryPhoto(collection.id, photoId);
      setCollection(updated);
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
          <title>ポケふたコレクト</title>
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
        <title>{`${lid.municipality}｜${lid.pokemonFeatured.join('・')} - ポケふたコレクト`}</title>
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
                    <View style={[styles.geoBadge, { backgroundColor: MEDAL_BADGE_COLOR[p.medal].bg }]}>
                      <Text style={[styles.geoBadgeText, { color: MEDAL_BADGE_COLOR[p.medal].fg }]}>
                        {MEDAL_LABEL[p.medal]}
                      </Text>
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
            <View>
              <Text style={styles.collectedLabel}>
                ✓ 収集済み（{formatDateJST(guestCollection.visitedAt)}・端末に保存中）
              </Text>
              {guestPhotos.length > 0 && (
                <ScrollView horizontal style={styles.photoRow}>
                  {guestPhotos.map((p) => (
                    <View key={p.id} style={styles.photoThumbWrapper}>
                      <Image
                        source={{ uri: p.uri }}
                        style={styles.photoThumb}
                        accessibilityLabel={`${lid.municipality}で撮影した写真`}
                      />
                      {/* attention (7-9), not a confirmed medal color — this
                          distance is a client-side EXIF read, not the
                          server's final judgment (see captureGuestPhoto). */}
                      <View style={[styles.geoBadge, { backgroundColor: colors.background }]}>
                        <Text style={[styles.geoBadgeText, { color: colors.attention }]}>
                          {formatPhotoDistance(p.distanceMeters)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
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

          {/* Photo capture (7-9): available to everyone now, not just
              logged-in users — onPickPhoto/PhotoPreviewModal are already
              user-neutral, and onConfirmUpload branches to the guest path
              below when there's no `user`. Upload progress only applies to
              the logged-in path (a real network transfer); the guest path
              has no transfer to show progress for. */}
          {user && uploading && (
            <View style={styles.uploadProgress}>
              <View style={styles.uploadProgressTrack}>
                <View
                  style={[
                    styles.uploadProgressFill,
                    { width: `${Math.round((uploadProgress ?? 0) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.uploadProgressLabel}>
                アップロード中… {Math.round((uploadProgress ?? 0) * 100)}%
              </Text>
            </View>
          )}
          <Button
            title="写真を撮って記録する"
            onPress={() => onPickPhoto('camera')}
            loading={uploading}
            disabled={uploading}
          />
          <Button
            title="ライブラリから選ぶ"
            onPress={() => onPickPhoto('library')}
            loading={uploading}
            disabled={uploading}
            variant="secondary"
          />

          {!user && (
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
                  title="写真なしで訪問済みにする（端末に保存）"
                  onPress={onMarkGuestVisited}
                  loading={savingGuest}
                  variant="secondary"
                />
              )}
              <Text style={styles.guestHint}>ログインすると、他の端末でも見られます</Text>
              <Button title="ログインする" onPress={() => router.push('/login')} variant="secondary" />
            </>
          )}
        </View>
      </ScrollView>
      <PhotoPreviewModal
        visible={pendingPhoto !== null}
        uri={pendingPhoto?.uri ?? null}
        source={pendingPhoto?.source ?? 'camera'}
        distanceMeters={pendingPhotoDistanceMeters}
        pokeLidMunicipality={lid.municipality}
        onConfirm={onConfirmUpload}
        onRetake={onRetakePhoto}
        onDismiss={onDismissPreview}
      />
      <CelebrationModal
        visible={celebration !== null}
        medal={celebration?.medal ?? null}
        milestone={celebration?.milestone ?? null}
        summary={celebration?.summary ?? null}
        // "全国に481箇所あります" (7-4 item 3) is computed from the bundled
        // snapshot rather than a dedicated API field — it's static data the
        // client already has (see generateStaticParams above) — and only
        // passed through at all on a user's very first collection, matching
        // isFirstCollection's purpose (see its doc comment in
        // packages/shared): showing "the scale of it all" on every
        // subsequent record would just be noise.
        totalPokeLidsNationwide={
          celebration?.summary.isFirstCollection
            ? (POKE_LIDS as PokeLidDto[]).filter((l) => countsTowardProgress(l.retiredAt)).length
            : null
        }
        onClose={() => setCelebration(null)}
        onRetake={onRetakeFromCelebration}
        onNavigateToNext={onNavigateToNext}
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
  // No color override (was colors.danger) — this is an informational note,
  // not an error, so it falls back to typography.footnote's own textSecondary.
  guestHint: { ...typography.footnote, textAlign: 'center' },
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
  // color comes from MEDAL_BADGE_COLOR[medal].fg (7-7) — varies per medal,
  // so it can't live in this static stylesheet entry.
  geoBadgeText: { fontSize: 10, fontWeight: '600' },
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
  uploadProgress: { gap: spacing.xs },
  uploadProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  uploadProgressFill: { height: '100%', backgroundColor: colors.accent },
  uploadProgressLabel: { ...typography.footnote, textAlign: 'center' },
});
