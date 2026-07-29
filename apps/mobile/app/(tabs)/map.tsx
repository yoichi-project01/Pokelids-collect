import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { getApiBaseUrl } from '../../src/lib/api';
import { buildMapHtml } from '../../src/lib/mapHtml';
import { useMapMarkers } from '../../src/lib/useMapMarkers';
import { colors } from '../../src/theme';

export default function MapScreen() {
  const router = useRouter();
  const { markers, location } = useMapMarkers();

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

  if (!markers) {
    return (
      <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.black} />
      </ScreenContainer>
    );
  }

  return (
    <WebView
      originWhitelist={['*']}
      source={{
        html: buildMapHtml(
          markers,
          getApiBaseUrl(),
          location ? { lat: location.latitude, lng: location.longitude } : null,
        ),
      }}
      onMessage={onMessage}
    />
  );
}
