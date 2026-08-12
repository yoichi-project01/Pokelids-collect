import { Stack, type NativeStackHeaderProps } from 'expo-router';
import Head from 'expo-router/head';
import { Platform } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { InstallPrompt } from '../src/components/InstallPrompt';
import { Onboarding } from '../src/components/Onboarding';
import { Toast } from '../src/components/Toast';
import { AuthProvider } from '../src/lib/auth';
import { colors } from '../src/theme';

// Baseline description for every route; a screen that renders its own
// <Head><meta name="description" .../></Head> further down the tree (e.g.
// poke-lids/[id].tsx) overrides this one, since both go through the same
// react-helmet-async instance. See the comment in +html.tsx for why this
// can't just be a static tag there instead.
const DEFAULT_DESCRIPTION =
  'ポケふた(ご当地ポケモンマンホール)を実際に訪問して写真を撮り、収集記録として残すアプリ。';

// Renders AppHeader (a header whose content row is capped at
// CONTENT_MAX_WIDTH) instead of the default header — see AppHeader's comment
// for why headerStyle's maxWidth can't do this itself. Web only; native
// keeps the platform header untouched.
function renderWebHeader({ options, route, back, navigation }: NativeStackHeaderProps) {
  return (
    <AppHeader
      title={typeof options.headerTitle === 'string' ? options.headerTitle : (options.title ?? route.name)}
      canGoBack={!!back}
      onBack={() => navigation.goBack()}
    />
  );
}

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerShadowVisible: false,
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerBackTitle: '',
  contentStyle: { backgroundColor: colors.background },
  ...(Platform.OS === 'web' && { header: renderWebHeader }),
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
        <Stack.Screen name="verify-email" options={{ title: 'メールアドレスの確認' }} />
        <Stack.Screen name="auth/google/callback" options={{ title: 'Googleでログイン' }} />
        <Stack.Screen name="prefectures/[id]" options={{ title: '都道府県別一覧' }} />
        <Stack.Screen name="poke-lids/[id]" options={{ title: 'ポケふた詳細' }} />
        <Stack.Screen name="privacy" options={{ title: 'プライバシーポリシー' }} />
        <Stack.Screen name="terms" options={{ title: '利用規約' }} />
      </Stack>
      <Toast />
      <Onboarding />
      <InstallPrompt />
    </AuthProvider>
  );
}
