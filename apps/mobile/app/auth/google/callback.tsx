import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { ApiError } from '../../../src/lib/api';
import { useAuth } from '../../../src/lib/auth';
import { consumeGoogleCallback } from '../../../src/lib/googleAuth';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Status = 'exchanging' | 'success' | 'error';

const GENERIC_ERROR = 'Googleログインに失敗しました。もう一度お試しください。';
const CANCELLED_ERROR = 'ログインがキャンセルされました。';
const INVALID_LINK_ERROR = 'このリンクは無効です。ログイン画面からもう一度お試しください。';

// Used only to route the two purely-synchronous rejection cases (Google
// reported an error, or state/nonce validation failed) through the same
// .catch() as the async exchange call below, rather than calling setState
// directly inline in the effect — react-hooks' set-state-in-effect rule
// flags the latter as a cascading-render risk. Throwing inside the promise
// chain built in the effect below means every setState call ends up inside
// a .then()/.catch() callback, which per the Promise spec is always
// microtask-deferred, never synchronous within the effect itself, even when
// the "async work" is really just an immediate throw.
class CallbackFlowError extends Error {
  constructor(public reason: 'cancelled' | 'invalid-link') {
    super(reason);
  }
}

// The page Google redirects the browser back to after the consent screen —
// never linked to from within this app, only ever reached via that
// redirect. See googleAuth.ts's own module comment for why this whole
// exchange is client-driven (a same-origin fetch from here, not a further
// server-side redirect) rather than the server handling the callback
// itself.
export default function GoogleCallbackScreen() {
  const {
    code: rawCode,
    state,
    error: googleError,
  } = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
  }>();
  const router = useRouter();
  const { user, loginWithGoogleCode } = useAuth();
  const [status, setStatus] = useState<Status>('exchanging');
  const [errorMessage, setErrorMessage] = useState(GENERIC_ERROR);
  // Guards against StrictMode/fast-refresh double-invoking the effect and
  // attempting the exchange twice with an authorization code that's only
  // valid for a single use — the same concern verify-email.tsx's `attempted`
  // ref guards against for its own single-use token.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    Promise.resolve()
      .then(() => {
        if (googleError) {
          throw new CallbackFlowError(googleError === 'access_denied' ? 'cancelled' : 'invalid-link');
        }
        const result = consumeGoogleCallback({ code: rawCode, state });
        if (!result) throw new CallbackFlowError('invalid-link');
        return loginWithGoogleCode(result.code, result.nonce);
      })
      .then(() => setStatus('success'))
      .catch((e) => {
        if (e instanceof CallbackFlowError) {
          setErrorMessage(e.reason === 'cancelled' ? CANCELLED_ERROR : INVALID_LINK_ERROR);
        } else if (e instanceof ApiError && e.status === 409) {
          // The one case with genuine, task-specified user-facing Japanese
          // copy already baked into the server's response (see apps/api's
          // routes/auth.ts /google/exchange, 409) — every other failure
          // mode here (expired code, misconfigured server, network error)
          // gets the generic fallback instead of surfacing an
          // internal/English message.
          setErrorMessage(e.message);
        } else {
          setErrorMessage(GENERIC_ERROR);
        }
        setStatus('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors verify-email.tsx's own post-success redirect logic: this screen
  // is reached the same way whether or not the tab happened to be logged in
  // already (it never is, in practice — Google's page is a full external
  // navigation), so `user` is read fresh from context right when it's
  // needed rather than assumed.
  return (
    <ScreenContainer>
      <Head>
        <title>Googleでログイン - ポケふたコレクト</title>
      </Head>
      <View style={styles.content}>
        {status === 'exchanging' && (
          <>
            <ActivityIndicator size="large" color={colors.black} />
            <Text style={styles.message}>ログインしています…</Text>
          </>
        )}
        {status === 'success' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>ログインしました。</Text>
            <Button title="ホームへ" onPress={() => router.replace('/')} />
          </View>
        )}
        {status === 'error' && (
          <View style={styles.errorBlock}>
            <Text style={styles.error}>{errorMessage}</Text>
            <Button title="ログイン画面へ" onPress={() => router.replace(user ? '/' : '/login')} />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, gap: spacing.lg },
  message: { ...typography.body, color: colors.textSecondary },
  errorBlock: { gap: spacing.md, alignItems: 'center' },
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
