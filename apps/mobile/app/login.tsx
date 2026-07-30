import { Link, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/Button';
import { PasswordField } from '../src/components/PasswordField';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { useAuth } from '../src/lib/auth';
import { colors, radius, spacing, typography } from '../src/theme';

export default function LoginScreen() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // Leaving this screen (successful login, or navigating back) means the
  // notice has served its purpose — clear it so it doesn't reappear on a
  // later, unrelated visit to this screen.
  useEffect(() => clearSessionExpired, [clearSessionExpired]);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Head>
        <title>ログイン - ポケふた収集</title>
      </Head>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>ポケふた収集</Text>
          {sessionExpired && (
            <View style={styles.sessionExpiredNotice}>
              <Text style={styles.sessionExpiredNoticeText}>
                セッションの有効期限が切れました。再度ログインしてください
              </Text>
            </View>
          )}
          <View style={styles.form}>
            <TextField
              placeholder="メールアドレス"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              value={email}
              onChangeText={setEmail}
            />
            <PasswordField
              ref={passwordRef}
              placeholder="パスワード"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="ログイン" onPress={onSubmit} loading={submitting} />
            <Button title="新規登録はこちら" onPress={() => router.push('/register')} variant="ghost" />
          </View>
          <View style={styles.legalLinks}>
            <Link href="/terms" style={styles.legalLink}>
              利用規約
            </Link>
            <Link href="/privacy" style={styles.legalLink}>
              プライバシーポリシー
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.largeTitle, textAlign: 'center', marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  sessionExpiredNotice: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sessionExpiredNoticeText: { ...typography.footnote, color: colors.accent, fontWeight: '600' },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xl },
  legalLink: { ...typography.footnote, color: colors.accent, textDecorationLine: 'underline' },
});
