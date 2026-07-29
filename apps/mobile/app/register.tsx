import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../src/lib/auth';

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
    <View style={styles.container}>
      <Text style={styles.title}>新規登録</Text>
      <TextInput
        style={styles.input}
        placeholder="表示名"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード（8文字以上）"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title={submitting ? '登録中…' : '登録する'} onPress={onSubmit} disabled={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: 'red' },
});
