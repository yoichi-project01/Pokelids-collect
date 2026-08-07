import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { getApiBaseUrl } from '../../src/lib/api';
import { buildMapHtml } from '../../src/lib/mapHtml';
import { useMapMarkers } from '../../src/lib/useMapMarkers';
import { colors, spacing } from '../../src/theme';

export default function MapScreen() {
  const router = useRouter();
  const { markers, location, error, reload } = useMapMarkers();
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

  if (error && !visibleMarkers) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        {head}
        <ErrorState message="地図データを取得できませんでした" onRetry={reload} />
      </ScreenContainer>
    );
  }

  if (!visibleMarkers) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        {head}
        <ActivityIndicator size="large" color={colors.black} />
      </ScreenContainer>
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
      </View>
      <iframe
        title="poke-lids-map"
        srcDoc={buildMapHtml(
          visibleMarkers,
          getApiBaseUrl(),
          location ? { lat: location.latitude, lng: location.longitude } : null,
        )}
        style={{ border: 'none', width: '100%', flex: 1 }}
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
});
