import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { AuthProvider } from '../src/lib/auth';
import { colors } from '../src/theme';

// Baseline description for every route; a screen that renders its own
// <Head><meta name="description" .../></Head> further down the tree (e.g.
// poke-lids/[id].tsx) overrides this one, since both go through the same
// react-helmet-async instance. See the comment in +html.tsx for why this
// can't just be a static tag there instead.
const DEFAULT_DESCRIPTION =
  'ポケふた(ご当地ポケモンマンホール)を実際に訪問して写真を撮り、収集記録として残すアプリ。';

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
      <Head>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
      </Head>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'ログイン' }} />
        <Stack.Screen name="register" options={{ title: '新規登録' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'パスワードをお忘れの方' }} />
        <Stack.Screen name="reset-password" options={{ title: 'パスワードの再設定' }} />
        <Stack.Screen name="prefectures/[id]" options={{ title: '都道府県別一覧' }} />
        <Stack.Screen name="poke-lids/[id]" options={{ title: 'ポケふた詳細' }} />
        <Stack.Screen name="privacy" options={{ title: 'プライバシーポリシー' }} />
        <Stack.Screen name="terms" options={{ title: '利用規約' }} />
      </Stack>
    </AuthProvider>
  );
}
