import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { useAuth } from '../src/lib/auth';
import { colors, spacing, typography } from '../src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/prefectures');
    } catch {
      setError('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer padded style={styles.center}>
      <Head>
        <title>ログイン - ポケふた収集</title>
      </Head>
      <Text style={styles.title}>ポケふた収集</Text>
      <View style={styles.form}>
        <TextField
          placeholder="メールアドレス"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField placeholder="パスワード" secureTextEntry value={password} onChangeText={setPassword} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="ログイン" onPress={onSubmit} loading={submitting} />
        <Button title="新規登録はこちら" onPress={() => router.push('/register')} variant="ghost" />
      </View>
      <View style={styles.legalLinks}>
        <Text style={styles.legalLink} onPress={() => router.push('/terms')}>
          利用規約
        </Text>
        <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>
          プライバシーポリシー
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  title: { ...typography.largeTitle, textAlign: 'center', marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.xl },
  legalLink: { ...typography.footnote, color: colors.textTertiary, textDecorationLine: 'underline' },
});
