import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { confirmEmailVerification } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { colors, radius, spacing, typography } from '../src/theme';

type Status = 'confirming' | 'success' | 'error';

// Unlike reset-password.tsx, this needs no input from the user beyond the
// token already in the URL — the link itself is the whole action, so this
// confirms automatically on mount rather than waiting for a form submit.
export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'error');
  // Guards against StrictMode/fast-refresh double-invoking the effect and
  // burning the single-use token on its own second call before the first
  // response even lands.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    confirmEmailVerification(token)
      .then(async () => {
        // Updates the logged-in tab's own `user` in place so the settings
        // screen's "未確認" notice disappears immediately — a no-op if this
        // tab isn't logged in (the common case: the link is usually opened
        // fresh from an email client, not the same session that registered).
        await refreshUser();
        setStatus('success');
      })
      .catch(() => {
        setStatus('error');
      });
    // refreshUser's identity is stable enough for this one-shot effect —
    // re-running it on every AuthProvider re-render would also risk
    // re-confirming with an already-consumed token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <ScreenContainer>
      <Head>
        <title>メールアドレスの確認 - ポケふたコレクト</title>
      </Head>
      <View style={styles.content}>
        {status === 'confirming' && (
          <>
            <ActivityIndicator size="large" color={colors.black} />
            <Text style={styles.message}>確認しています…</Text>
          </>
        )}
        {status === 'success' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>メールアドレスを確認しました。</Text>
            <Button
              title={user ? 'ホームへ' : 'ログイン画面へ'}
              onPress={() => router.replace(user ? '/' : '/login')}
            />
          </View>
        )}
        {status === 'error' && (
          <Text style={styles.error}>
            リンクの有効期限が切れているか、既に使用されています。設定画面からもう一度お試しください。
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  message: { ...typography.body, color: colors.textSecondary },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  notice: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  noticeText: { ...typography.body, color: colors.accent, textAlign: 'center' },
});
