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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'ログイン' }} />
        <Stack.Screen name="register" options={{ title: '新規登録' }} />
        <Stack.Screen name="prefectures/[id]" options={{ title: '都道府県別一覧' }} />
        <Stack.Screen name="poke-lids/[id]" options={{ title: 'ポケふた詳細' }} />
        <Stack.Screen name="privacy" options={{ title: 'プライバシーポリシー' }} />
        <Stack.Screen name="terms" options={{ title: '利用規約' }} />
      </Stack>
    </AuthProvider>
  );
}
