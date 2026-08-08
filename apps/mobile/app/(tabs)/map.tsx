import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { CelebrationModal } from '../../src/components/CelebrationModal';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { MapRefreshButton } from '../../src/components/MapRefreshButton';
import { PhotoPreviewModal } from '../../src/components/PhotoPreviewModal';
import { ScreenContainer } from '../../src/components/ScreenContainer';
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
  const webViewRef = useRef<WebView>(null);

  // Patches the just-recorded pin to teal in place, via leaflet-init.js's
  // reverse postMessage channel, instead of refetching/regenerating the
  // whole map — which would reset pan/zoom right when the user most wants
  // the map to hold still (6-6).
  const quickRecord = useQuickRecord((pokeLidId) => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'markCollected', id: pokeLidId }));
  });

  function onMessage(event: WebViewMessageEvent) {
    let data: { type?: string; id?: string };
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === 'select' && data.id) {
      router.push(`/poke-lids/${data.id}`);
    } else if (data.type === 'quickRecord' && data.id) {
      void quickRecord.startQuickRecord(data.id);
    }
  }

  const visibleMarkers = useMemo(
    () => (markers && uncollectedOnly ? markers.filter((m) => !m.collected) : markers),
    [markers, uncollectedOnly],
  );

  if (error && !visibleMarkers) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ErrorState message="地図データを取得できませんでした" onRetry={reload} />
      </ScreenContainer>
    );
  }

  if (!visibleMarkers) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.black} />
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        <View style={styles.emptyContainer}>
          <EmptyState
            title="この範囲はすべて集めました"
            message="フィルタを「すべて」に戻すと、収集済みのポケふたも含めて確認できます。"
            actionLabel="すべて表示"
            onAction={() => setUncollectedOnly(false)}
          />
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          style={{ flex: 1 }}
          originWhitelist={['*']}
          source={{
            html: buildMapHtml(
              visibleMarkers,
              getApiBaseUrl(),
              location ? { lat: location.latitude, lng: location.longitude } : null,
            ),
          }}
          onMessage={onMessage}
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
