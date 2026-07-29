import { Stack } from 'expo-router';
import { AuthProvider } from '../src/lib/auth';
import { colors } from '../src/theme';

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.background },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'ログイン' }} />
        <Stack.Screen name="register" options={{ title: '新規登録' }} />
        <Stack.Screen name="prefectures/index" options={{ title: 'ポケふた収集進捗' }} />
        <Stack.Screen name="map" options={{ title: '地図で見る' }} />
        <Stack.Screen name="prefectures/[id]" options={{ title: '都道府県別一覧' }} />
        <Stack.Screen name="poke-lids/[id]" options={{ title: 'ポケふた詳細' }} />
        <Stack.Screen name="collection" options={{ title: '自分の収集記録' }} />
      </Stack>
    </AuthProvider>
  );
}
