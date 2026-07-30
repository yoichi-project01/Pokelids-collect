import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { requestPasswordReset } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    setError(false);
    try {
      // The server always returns the same response whether or not the
      // email is registered, so `sent` is the only outcome to show here —
      // a different UI depending on account existence would leak the same
      // information the server is deliberately not leaking. A genuine
      // request failure (network, malformed input) is a separate case and
      // still safe to surface distinctly.
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Head>
        <title>パスワードをお忘れの方 - ポケふた収集</title>
      </Head>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>パスワードの再設定</Text>
          {sent ? (
            <View style={styles.sentNotice}>
              <Text style={styles.sentNoticeText}>
                入力されたメールアドレス宛にパスワード再設定用のメールを送信しました（登録されているメールアドレスの場合）。届いたメール内のリンクから1時間以内に手続きを完了してください。
              </Text>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.description}>
                登録済みのメールアドレスを入力してください。パスワード再設定用のリンクを送信します。
              </Text>
              <TextField
                placeholder="メールアドレス"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                keyboardType="email-address"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                value={email}
                onChangeText={setEmail}
              />
              {error && <Text style={styles.error}>送信に失敗しました。時間をおいて再度お試しください</Text>}
              <Button title="再設定メールを送信" onPress={onSubmit} loading={submitting} />
            </View>
          )}
          <Button title="ログイン画面に戻る" onPress={() => router.replace('/login')} variant="ghost" />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.largeTitle, textAlign: 'center', marginBottom: spacing.md },
  description: { ...typography.body, color: colors.textSecondary },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  sentNotice: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  sentNoticeText: { ...typography.body, color: colors.accent },
});
