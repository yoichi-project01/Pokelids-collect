import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { buildMapHtml } from '../src/lib/mapHtml';
import { useMapMarkers } from '../src/lib/useMapMarkers';
import { colors } from '../src/theme';

export default function MapScreen() {
  const router = useRouter();
  const markers = useMapMarkers();

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

  const head = (
    <Head>
      <title>地図 - ポケふた収集</title>
    </Head>
  );

  if (!markers) {
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
      <iframe
        title="poke-lids-map"
        srcDoc={buildMapHtml(markers)}
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </View>
  );
}
