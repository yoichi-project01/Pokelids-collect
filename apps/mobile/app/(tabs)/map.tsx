import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
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

  function onMessage(event: WebViewMessageEvent) {
    let data: { type?: string; id?: string };
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === 'select' && data.id) {
      router.push(`/poke-lids/${data.id}`);
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
      </View>
      <WebView
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
