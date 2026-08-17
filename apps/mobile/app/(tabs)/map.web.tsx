import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CelebrationModal } from '../../src/components/CelebrationModal';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { MapRefreshButton } from '../../src/components/MapRefreshButton';
import { PhotoPreviewModal } from '../../src/components/PhotoPreviewModal';
import { UploadProgressBanner } from '../../src/components/UploadProgressBanner';
import { getApiBaseUrl } from '../../src/lib/api';
import { buildMapHtml } from '../../src/lib/mapHtml';
import { useMapMarkers } from '../../src/lib/useMapMarkers';
import { useQuickRecord } from '../../src/lib/useQuickRecord';
import { colors, spacing } from '../../src/theme';

export default function MapScreen() {
  const router = useRouter();
  const { markers, location, error, refreshing, reload } = useMapMarkers();
  const [uncollectedOnly, setUncollectedOnly] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Patches the just-recorded pin to teal in place, via leaflet-init.js's
  // reverse postMessage channel, instead of refetching/regenerating the
  // whole map — which would reset pan/zoom right when the user most wants
  // the map to hold still (6-6).
  const quickRecord = useQuickRecord((pokeLidId) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ type: 'markCollected', id: pokeLidId }),
      '*',
    );
  });
  // useQuickRecord returns a fresh object every render, so the message
  // listener effect below reads through this ref rather than depending on
  // `quickRecord` directly — depending on it would tear down and re-add the
  // window listener on every render for no benefit. Updated in its own
  // effect (not during render) per react-hooks/refs.
  const quickRecordRef = useRef(quickRecord);
  useEffect(() => {
    quickRecordRef.current = quickRecord;
  });

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      let data: { type?: string; id?: string };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === 'select' && data.id) {
        router.push(`/poke-lids/${data.id}`);
      } else if (data.type === 'quickRecord' && data.id) {
        void quickRecordRef.current.startQuickRecord(data.id);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  const visibleMarkers = useMemo(
    () => (markers && uncollectedOnly ? markers.filter((m) => !m.collected) : markers),
    [markers, uncollectedOnly],
  );

  const head = (
    <Head>
      <title>地図 - ポケふたコレクト</title>
    </Head>
  );

  // Not ScreenContainer here: the success state below is intentionally
  // full-width (a map benefits from all the screen it can get), and
  // ScreenContainer's CONTENT_MAX_WIDTH cap would make the loading/error
  // states narrower than the map they're standing in for. Unaffected by
  // 2026-08-17's CONTENT_MAX_WIDTH widening for the same reason it was
  // never at 720 either — this screen never imports that constant.
  if (error && !visibleMarkers) {
    return (
      <View style={styles.fullWidthCenter}>
        {head}
        <ErrorState message="地図データを取得できませんでした" onRetry={reload} />
      </View>
    );
  }

  if (!visibleMarkers) {
    return (
      <View style={styles.fullWidthCenter}>
        {head}
        <ActivityIndicator size="large" color={colors.black} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {head}
      <View style={styles.filterRow}>
        <FilterChip
          label="すべて"
          selected={!uncollectedOnly}
          onPress={() => setUncollectedOnly(false)}
          inactiveBackgroundColor={colors.background}
        />
        <FilterChip
          label="未収集のみ"
          selected={uncollectedOnly}
          onPress={() => setUncollectedOnly(true)}
          inactiveBackgroundColor={colors.background}
        />
        <MapRefreshButton refreshing={refreshing} onPress={reload} />
      </View>
      {uncollectedOnly && visibleMarkers.length === 0 ? (
        <View style={styles.fullWidthCenter}>
          <EmptyState
            title="この範囲はすべて集めました"
            message="フィルタを「すべて」に戻すと、収集済みのポケふたも含めて確認できます。"
            actionLabel="すべて表示"
            onAction={() => setUncollectedOnly(false)}
          />
        </View>
      ) : (
        <iframe
          ref={iframeRef}
          title="poke-lids-map"
          srcDoc={buildMapHtml(
            visibleMarkers,
            getApiBaseUrl(),
            location ? { lat: location.latitude, lng: location.longitude } : null,
          )}
          style={{ border: 'none', width: '100%', flex: 1 }}
        />
      )}
      {quickRecord.uploading && <UploadProgressBanner progress={quickRecord.uploadProgress} />}
      <PhotoPreviewModal
        visible={quickRecord.pendingPhoto !== null}
        uri={quickRecord.pendingPhoto?.uri ?? null}
        source="camera"
        onConfirm={quickRecord.confirmUpload}
        onRetake={quickRecord.retakePhoto}
        onDismiss={quickRecord.dismissPreview}
      />
      <CelebrationModal
        visible={quickRecord.celebration !== null}
        medal={quickRecord.celebration?.medal ?? null}
        milestone={quickRecord.celebration?.milestone ?? null}
        summary={quickRecord.celebration?.summary ?? null}
        totalPokeLidsNationwide={quickRecord.totalPokeLidsNationwide}
        onClose={quickRecord.closeCelebration}
        onRetake={quickRecord.retakeFromCelebration}
        onNavigateToNext={quickRecord.navigateToNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullWidthCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
