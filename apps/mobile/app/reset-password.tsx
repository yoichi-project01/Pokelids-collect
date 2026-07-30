import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { PasswordField } from '../src/components/PasswordField';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { confirmPasswordReset } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    if (!token) return;
    setError(null);
    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(token, newPassword);
      setDone(true);
    } catch {
      // Expired/already-used/malformed tokens and a bad network request all
      // land here — from the user's side there's nothing actionable to
      // distinguish, they just need a fresh reset request either way.
      setError('リンクの有効期限が切れているか、既に使用されています。もう一度お試しください');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Head>
        <title>パスワードの再設定 - ポケふた収集</title>
      </Head>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>新しいパスワードを設定</Text>
          {!token ? (
            <Text style={styles.error}>無効なリンクです。パスワード再設定をやり直してください</Text>
          ) : done ? (
            <View style={styles.doneNotice}>
              <Text style={styles.doneNoticeText}>
                パスワードを再設定しました。新しいパスワードでログインしてください。
              </Text>
              <Button title="ログイン画面へ" onPress={() => router.replace('/login')} />
            </View>
          ) : (
            <View style={styles.form}>
              <PasswordField
                placeholder="新しいパスワード（8文字以上）"
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button title="パスワードを更新" onPress={onSubmit} loading={submitting} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.largeTitle, textAlign: 'center', marginBottom: spacing.md },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  doneNotice: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  doneNoticeText: { ...typography.body, color: colors.accent },
});
