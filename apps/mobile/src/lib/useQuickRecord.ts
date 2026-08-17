import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { computeCelebrationMilestone, type CollectionSummary, type PhotoMedal } from '@pokelids/shared';
import { ApiError, uploadCollection, type UploadPhotoInput } from './api';
import { useCollections } from './collections';
import { TOTAL_POKE_LIDS_NATIONWIDE } from './pokeLidsData';
import { showToast } from './toast';

interface PendingQuickPhoto extends UploadPhotoInput {
  pokeLidId: string;
}

interface QuickCelebration {
  pokeLidId: string;
  medal: PhotoMedal;
  milestone: string | null;
  summary: CollectionSummary;
}

// Backs the map's "写真を撮って記録" quick-record flow (6-6) — the same
// pick → preview → upload → celebrate sequence as the poke-lid detail
// screen's onPickPhoto/onConfirmUpload, extracted here so both `map.tsx` and
// `map.web.tsx` (near-duplicate platform files) share one implementation
// instead of copy-pasting ~100 lines of upload/celebration state twice.
//
// `onCollected` fires right after a successful upload with the recorded
// poke lid's id, before the celebration modal's own state settles — the map
// screens use it to patch that pin to "collected" in place (via
// leaflet-init.js's reverse postMessage channel) without regenerating the
// whole map, which would reset the user's pan/zoom.
export function useQuickRecord(onCollected: (pokeLidId: string) => void) {
  const router = useRouter();
  const { upsertCollection } = useCollections();
  const [pendingPhoto, setPendingPhoto] = useState<PendingQuickPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  // Fraction (0–1) — see UploadProgressBanner, which does its own rounding.
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<QuickCelebration | null>(null);

  // Only ever launches the camera, unlike the detail screen's onPickPhoto
  // (camera or library): "写真を撮って記録" is specifically about a photo
  // taken right now, standing at the pin — the whole premise the 200m
  // QUICK_RECORD_RADIUS_METERS gate already establishes. Picking an old
  // library photo would defeat that; anyone who wants the library option
  // still has it via the popup's "詳細を見る" → the ordinary detail screen.
  async function startQuickRecord(pokeLidId: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      showToast('権限が必要です', 'カメラへのアクセス許可が必要です');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPendingPhoto({
      pokeLidId,
      uri: asset.uri,
      name: asset.fileName ?? `${pokeLidId}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      // Only present on web — see UploadPhotoInput's doc comment in api.ts.
      webFile: asset.file,
    });
  }

  function retakePhoto() {
    const pokeLidId = pendingPhoto?.pokeLidId;
    setPendingPhoto(null);
    if (pokeLidId) void startQuickRecord(pokeLidId);
  }

  function dismissPreview() {
    setPendingPhoto(null);
  }

  async function confirmUpload() {
    if (!pendingPhoto) return;
    const { pokeLidId, ...photo } = pendingPhoto;
    setPendingPhoto(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const { collection: updated, summary } = await uploadCollection(
        { pokeLidId, photo },
        setUploadProgress,
      );
      // Patches the shared collections context (7-6) so other tabs — the
      // collection grid, home's collectedIds filter, prefecture detail —
      // reflect this record immediately without a refetch. Separate from
      // onCollected below, which only patches this map's own rendered pin.
      upsertCollection(updated);
      onCollected(pokeLidId);

      // The photo this request just added is the newest one — the server
      // always returns `photos` ordered oldest-first.
      const newPhoto = updated.photos[updated.photos.length - 1] ?? null;
      if (newPhoto) {
        setCelebration({
          pokeLidId,
          medal: newPhoto.medal,
          milestone: computeCelebrationMilestone(summary),
          summary,
        });
      }
    } catch (err) {
      showToast('エラー', err instanceof ApiError ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function retakeFromCelebration() {
    const pokeLidId = celebration?.pokeLidId;
    setCelebration(null);
    if (pokeLidId) void startQuickRecord(pokeLidId);
  }

  function closeCelebration() {
    setCelebration(null);
  }

  // Unlike the detail screen's onNavigateToNext, there's no "stay in place"
  // option here — the suggested next poke lid is rarely the one currently
  // centered on the map, so jumping to its own detail screen (with
  // directions, full photo history, etc.) is the more useful landing spot.
  function navigateToNext(nextPokeLidId: string) {
    setCelebration(null);
    router.push(`/poke-lids/${nextPokeLidId}`);
  }

  // Only computed when it'll actually be shown (isFirstCollection) — see
  // CelebrationModal's own doc comment for why. Sourced from the bundled
  // snapshot (7-7) rather than an API field, same as the detail screen.
  const totalPokeLidsNationwide = celebration?.summary.isFirstCollection ? TOTAL_POKE_LIDS_NATIONWIDE : null;

  return {
    pendingPhoto,
    uploading,
    uploadProgress,
    celebration,
    totalPokeLidsNationwide,
    startQuickRecord,
    retakePhoto,
    dismissPreview,
    confirmUpload,
    retakeFromCelebration,
    closeCelebration,
    navigateToNext,
  };
}
