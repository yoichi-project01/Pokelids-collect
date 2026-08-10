import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { deleteAccount } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { confirmAsync } from '../../src/lib/confirm';
import { MEDAL_BADGE_COLOR, MEDAL_LABEL, MEDAL_SHORT_LABEL } from '../../src/lib/medal';
import { showToast } from '../../src/lib/toast';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function onDeleteAccount() {
    const confirmed = await confirmAsync(
      'アカウントを削除',
      'アカウントと収集記録・写真をすべて削除します。この操作は取り消せません。よろしいですか？',
      '削除する',
    );
    if (!confirmed) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await logout();
    } catch {
      showToast('エラー', 'アカウントの削除に失敗しました');
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <ScreenContainer padded>
      {user ? (
        <View style={styles.card}>
          <Text style={styles.email}>{user.displayName}</Text>
          <Text style={styles.emailSub}>{user.email}</Text>
          <Button title="ログアウト" onPress={() => logout()} variant="secondary" />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.guestText}>ログインすると収集記録を保存できます</Text>
          <Button title="ログインする" onPress={() => router.push('/login')} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>メダルについて</Text>
        {(['GOLD', 'SILVER', 'NONE'] as const).map((medal) => (
          <View key={medal} style={styles.legendRow}>
            <View style={[styles.legendBadge, { backgroundColor: MEDAL_BADGE_COLOR[medal].bg }]}>
              <Text style={[styles.legendBadgeText, { color: MEDAL_BADGE_COLOR[medal].fg }]}>
                {MEDAL_SHORT_LABEL[medal]}
              </Text>
            </View>
            <Text style={styles.legendText}>
              {MEDAL_LABEL[medal]}
              {medal === 'GOLD' && '（写真の位置情報が現地と一致）'}
              {medal === 'SILVER' && '（写真に位置情報がなかった）'}
              {medal === 'NONE' && '（写真の位置情報が現地と一致しなかった）'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Link href="/terms" style={styles.link}>
          利用規約
        </Link>
        <Link href="/privacy" style={styles.link}>
          プライバシーポリシー
        </Link>
      </View>

      {user && (
        <Button
          title={deletingAccount ? '削除中…' : 'アカウントを削除する'}
          onPress={onDeleteAccount}
          loading={deletingAccount}
          variant="danger"
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  email: { ...typography.bodyMedium },
  emailSub: { ...typography.caption, marginBottom: spacing.xs },
  guestText: { ...typography.body, marginBottom: spacing.xs },
  sectionTitle: { ...typography.bodyMedium, marginBottom: spacing.xs },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // Replaces a plain color dot (7-7) — a dot alone can't carry a `bg`+`fg`
  // pair, and MEDAL_BADGE_COLOR's gold `bg` is pale enough that a same-sized
  // dot on this card's white background would have been nearly invisible.
  legendBadge: {
    minWidth: 28,
    paddingHorizontal: spacing.xs,
    height: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBadgeText: { fontSize: 12, fontWeight: '700' },
  legendText: { ...typography.caption, flex: 1 },
  // Link must stay a Link (not a Pressable) so it renders as a real <a> on
  // web — expanded via paddingVertical/minHeight instead, to still meet the
  // 44px iOS/Android HIG minimum tap target (paddingVertical: spacing.xs
  // alone left this at ~24px).
  link: {
    ...typography.body,
    color: colors.accent,
    textDecorationLine: 'underline',
    paddingVertical: spacing.md,
    minHeight: 44,
  },
});
