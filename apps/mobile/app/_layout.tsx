import { Stack } from 'expo-router';
import { AuthProvider } from '../src/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: 'ログイン' }} />
        <Stack.Screen name="register" options={{ title: '新規登録' }} />
        <Stack.Screen name="prefectures/index" options={{ title: 'ポケふた収集進捗' }} />
        <Stack.Screen name="prefectures/[id]" options={{ title: '都道府県別一覧' }} />
        <Stack.Screen name="poke-lids/[id]" options={{ title: 'ポケふた詳細' }} />
        <Stack.Screen name="collection" options={{ title: '自分の収集記録' }} />
      </Stack>
    </AuthProvider>
  );
}
