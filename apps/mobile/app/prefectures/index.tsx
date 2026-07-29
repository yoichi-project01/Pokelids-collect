import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ProgressDto } from '@pokelids/shared';
import { fetchPokeLids, fetchPrefectureProgress } from '../../src/lib/api';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds, mergeGuestProgress } from '../../src/lib/guestStorage';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.overallLabel}>全国合計</Text>
        {progress && <ProgressBar total={progress.totalPokeLids} collected={progress.collectedCount} />}
        {!user && !authLoading && (
          <Text style={styles.guestNotice}>ログインすると収集記録を保存できます</Text>
        )}
        <View style={styles.headerButtons}>
          <Button title="地図で見る" onPress={() => router.push('/map')} />
          {user ? (
            <>
              <Button title="自分の収集記録" onPress={() => router.push('/collection')} />
              <Button title="ログアウト" onPress={() => logout()} color="#999" />
            </>
          ) : (
            <Button title="ログイン" onPress={() => router.push('/login')} />
          )}
        </View>
      </View>
      <FlatList
        data={progress?.byPrefecture ?? []}
        keyExtractor={(item) => String(item.prefectureId)}
        refreshing={loading}
        onRefresh={() => loadProgress().then(setProgress)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/prefectures/${item.prefectureId}`)}
          >
            <Text style={styles.prefName}>{item.nameJa}</Text>
            <ProgressBar total={item.total} collected={item.collected} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  overallLabel: { fontSize: 14, color: '#777' },
  guestNotice: { fontSize: 12, color: '#e3350d' },
  headerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  row: { paddingVertical: 10, paddingHorizontal: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  prefName: { fontSize: 16, fontWeight: '600' },
});
