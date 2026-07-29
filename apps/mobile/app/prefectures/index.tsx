import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { ProgressDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { ListRow } from '../../src/components/ListRow';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchPokeLids, fetchPrefectureProgress } from '../../src/lib/api';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds, mergeGuestProgress } from '../../src/lib/guestStorage';
import { colors, spacing, typography } from '../../src/theme';

async function loadProgress(): Promise<ProgressDto> {
  const [progress, guestIds] = await Promise.all([fetchPrefectureProgress(), getGuestCollectedIds()]);
  if (guestIds.size === 0) return progress;
  const lids = await fetchPokeLids();
  return mergeGuestProgress(progress, lids, guestIds);
}

export default function PrefecturesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [progress, setProgress] = useState<ProgressDto | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadProgress()
        .then((data) => {
          if (!cancelled) setProgress(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [authLoading, user]),
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.overallLabel}>全国合計</Text>
        {progress && <ProgressBar total={progress.totalPokeLids} collected={progress.collectedCount} />}
        {!user && !authLoading && (
          <Text style={styles.guestNotice}>ログインすると収集記録を保存できます</Text>
        )}
        <View style={styles.headerButtons}>
          <Button title="地図で見る" onPress={() => router.push('/map')} variant="secondary" style={styles.headerButton} />
          {user ? (
            <>
              <Button
                title="収集記録"
                onPress={() => router.push('/collection')}
                variant="secondary"
                style={styles.headerButton}
              />
              <Button title="ログアウト" onPress={() => logout()} variant="ghost" style={styles.headerButton} />
            </>
          ) : (
            <Button title="ログイン" onPress={() => router.push('/login')} variant="primary" style={styles.headerButton} />
          )}
        </View>
      </View>
      <FlatList
        data={progress?.byPrefecture ?? []}
        keyExtractor={(item) => String(item.prefectureId)}
        refreshing={loading}
        onRefresh={() => loadProgress().then(setProgress)}
        style={styles.list}
        renderItem={({ item }) => (
          <ListRow
            title={item.nameJa}
            onPress={() => router.push(`/prefectures/${item.prefectureId}`)}
            right={
              <View style={styles.rowProgress}>
                <ProgressBar total={item.total} collected={item.collected} />
              </View>
            }
          />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  overallLabel: { ...typography.caption },
  guestNotice: { ...typography.footnote, color: colors.danger },
  headerButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  headerButton: { flex: 1, minHeight: 40 },
  list: { flex: 1 },
  rowProgress: { width: 110 },
});
