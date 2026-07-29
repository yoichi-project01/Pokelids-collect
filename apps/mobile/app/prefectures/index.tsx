import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { haversineDistanceMeters, type PokeLidDto, type ProgressDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchPokeLids, fetchPrefectureProgress } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollectedIds, mergeGuestProgress } from '../../src/lib/guestStorage';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import { colors, radius, spacing, typography } from '../../src/theme';

const NEXT_TO_COLLECT_COUNT = 12;

interface HomeData {
  progress: ProgressDto;
  imageByPrefecture: Map<number, string>;
  uncollected: PokeLidDto[];
}

async function loadHomeData(): Promise<HomeData> {
  const [progressRes, guestIds, lids, collections] = await Promise.all([
    fetchPrefectureProgress(),
    getGuestCollectedIds(),
    fetchPokeLids(),
    fetchMyCollections(),
  ]);

  const collectedIds = new Set([...collections.map((c) => c.pokeLidId), ...guestIds]);
  const progress = guestIds.size > 0 ? mergeGuestProgress(progressRes, lids, guestIds) : progressRes;

  const imageByPrefecture = new Map<number, string>();
  for (const lid of lids) {
    if (lid.officialImageUrl && !imageByPrefecture.has(lid.prefectureId)) {
      imageByPrefecture.set(lid.prefectureId, lid.officialImageUrl);
    }
  }

  const uncollected = lids.filter((l) => l.officialImageUrl && !collectedIds.has(l.id));

  return { progress, imageByPrefecture, uncollected };
}

export default function PrefecturesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadHomeData()
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [authLoading, user]),
  );

  const progress = data?.progress ?? null;
  const percent = progress && progress.totalPokeLids > 0 ? Math.round((progress.collectedCount / progress.totalPokeLids) * 100) : 0;

  const nextToCollect = useMemo(() => {
    const uncollected = data?.uncollected ?? [];
    if (!location) return uncollected.slice(0, NEXT_TO_COLLECT_COUNT);
    return [...uncollected]
      .sort(
        (a, b) =>
          haversineDistanceMeters(location.latitude, location.longitude, a.latitude, a.longitude) -
          haversineDistanceMeters(location.latitude, location.longitude, b.latitude, b.longitude),
      )
      .slice(0, NEXT_TO_COLLECT_COUNT);
  }, [data, location]);

  return (
    <ScreenContainer>
      <FlatList
        data={progress?.byPrefecture ?? []}
        keyExtractor={(item) => String(item.prefectureId)}
        refreshing={loading}
        onRefresh={() => loadHomeData().then(setData)}
        style={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>ポケふたコレクション</Text>
              <View style={styles.heroStatRow}>
                <Text style={styles.heroCount}>{progress?.collectedCount ?? 0}</Text>
                <Text style={styles.heroTotal}>/ {progress?.totalPokeLids ?? '—'} 匹</Text>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentBadgeText}>{percent}%</Text>
                </View>
              </View>
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

            {nextToCollect.length > 0 && (
              <View style={styles.nextSection}>
                <View style={styles.nextTitleRow}>
                  <Text style={styles.nextTitleText}>次に集めよう</Text>
                  {location && <Text style={styles.nextSortedLabel}>📍現在地から近い順</Text>}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nextRow}>
                  {nextToCollect.map((lid) => (
                    <TouchableOpacity
                      key={lid.id}
                      style={styles.nextCard}
                      onPress={() => router.push(`/poke-lids/${lid.id}`)}
                    >
                      <Image source={{ uri: lid.officialImageUrl! }} style={styles.nextImage} />
                      <Text style={styles.nextCaption} numberOfLines={1}>
                        {lid.municipality}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <Text style={styles.sectionTitle}>都道府県から探す</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.nameJa}
            imageUri={data?.imageByPrefecture.get(item.prefectureId)}
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
  list: { flex: 1 },
  hero: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  heroLabel: { ...typography.caption },
  heroStatRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  heroCount: { fontSize: 40, fontWeight: '800', color: colors.textPrimary },
  heroTotal: { ...typography.body, color: colors.textSecondary, marginRight: spacing.sm },
  percentBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  percentBadgeText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  guestNotice: { ...typography.footnote, color: colors.danger },
  headerButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  headerButton: { flex: 1, minHeight: 40 },
  rowProgress: { width: 110 },
  sectionTitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  nextSection: { backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  nextTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  nextTitleText: { ...typography.caption, textTransform: 'uppercase' },
  nextSortedLabel: { ...typography.footnote },
  nextRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  nextCard: { width: 96, gap: spacing.xs },
  nextImage: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.background },
  nextCaption: { ...typography.footnote, textAlign: 'center' },
});
