import { useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/components/Button';
import { ScreenContainer } from '../src/components/ScreenContainer';
import { TextField } from '../src/components/TextField';
import { useAuth } from '../src/lib/auth';
import { colors, spacing, typography } from '../src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, displayName.trim());
      router.replace('/prefectures');
    } catch (e) {
      setError(e instanceof Error ? e.message : '登録に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer padded style={styles.center}>
      <Head>
        <title>新規登録 - ポケふた収集</title>
      </Head>
      <Text style={styles.title}>新規登録</Text>
      <View style={styles.form}>
        <TextField placeholder="表示名" value={displayName} onChangeText={setDisplayName} />
        <TextField
          placeholder="メールアドレス"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          placeholder="パスワード（8文字以上）"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="登録する" onPress={onSubmit} loading={submitting} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  title: { ...typography.largeTitle, textAlign: 'center', marginBottom: spacing.xxl },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: 13 },
});
