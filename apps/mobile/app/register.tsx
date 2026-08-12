import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../src/components/Button';
import { GoogleSignInButton } from '../src/components/GoogleSignInButton';
import { PasswordField } from '../src/components/PasswordField';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { useAuth } from '../src/lib/auth';
import { isGoogleSignInAvailable, startGoogleSignIn } from '../src/lib/googleAuth';
import { colors, spacing, typography } from '../src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  // Evaluated once per mount — see login.tsx's identical use of this for why.
  const googleAvailable = isGoogleSignInAvailable();

  async function onSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim());
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Head>
        <title>新規登録 - ポケふたコレクト</title>
      </Head>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>新規登録</Text>
          {googleAvailable && (
            <View style={styles.googleSection}>
              <GoogleSignInButton title="Googleで登録" onPress={startGoogleSignIn} />
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>または</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          )}
          <View style={styles.form}>
            <TextField
              placeholder="表示名"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextField
              ref={emailRef}
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
              placeholder="パスワード（8文字以上）"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              value={password}
              onChangeText={setPassword}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="登録する" onPress={onSubmit} loading={submitting} />
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
  googleSection: { gap: spacing.lg, marginBottom: spacing.lg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { ...typography.footnote },
  error: { color: colors.danger, fontSize: 13 },
});
