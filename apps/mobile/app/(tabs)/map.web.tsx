import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { MapRefreshButton } from '../../src/components/MapRefreshButton';
import { getApiBaseUrl } from '../../src/lib/api';
import { buildMapHtml } from '../../src/lib/mapHtml';
import { useMapMarkers } from '../../src/lib/useMapMarkers';
import { colors, spacing } from '../../src/theme';

export default function MapScreen() {
  const router = useRouter();
  const { markers, location, error, refreshing, reload } = useMapMarkers();
  const [uncollectedOnly, setUncollectedOnly] = useState(false);

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
      <title>地図 - ポケふた収集</title>
    </Head>
  );

  // Not ScreenContainer here: the success state below is intentionally
  // full-width (a map benefits from all the screen it can get), and
  // ScreenContainer's 720px cap would make the loading/error states narrower
  // than the map they're standing in for.
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
          title="poke-lids-map"
          srcDoc={buildMapHtml(
            visibleMarkers,
            getApiBaseUrl(),
            location ? { lat: location.latitude, lng: location.longitude } : null,
          )}
          style={{ border: 'none', width: '100%', flex: 1 }}
        />
      )}
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
