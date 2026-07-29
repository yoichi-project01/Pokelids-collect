import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildMapHtml } from '../src/lib/mapHtml';
import { useMapMarkers } from '../src/lib/useMapMarkers';

export default function MapScreen() {
  const router = useRouter();
  const markers = useMapMarkers();

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <WebView originWhitelist={['*']} source={{ html: buildMapHtml(markers) }} onMessage={onMessage} />;
}
