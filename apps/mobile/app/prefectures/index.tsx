import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ProgressDto } from '@pokelids/shared';
import { fetchPrefectureProgress } from '../../src/lib/api';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useAuth } from '../../src/lib/auth';

export default function PrefecturesScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [progress, setProgress] = useState<ProgressDto | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchPrefectureProgress()
        .then((data) => {
          if (!cancelled) setProgress(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.overallLabel}>全国合計</Text>
        {progress && <ProgressBar total={progress.totalPokeLids} collected={progress.collectedCount} />}
        <View style={styles.headerButtons}>
          <Button title="地図で見る" onPress={() => router.push('/map')} />
          <Button title="自分の収集記録" onPress={() => router.push('/collection')} />
          <Button title="ログアウト" onPress={() => logout()} color="#999" />
        </View>
      </View>
      <FlatList
        data={progress?.byPrefecture ?? []}
        keyExtractor={(item) => String(item.prefectureId)}
        refreshing={loading}
        onRefresh={() => fetchPrefectureProgress().then(setProgress)}
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
  headerButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  row: { paddingVertical: 10, paddingHorizontal: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  prefName: { fontSize: 16, fontWeight: '600' },
});
