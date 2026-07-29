import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NearbyPokeLidDto, ProgressDto } from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import {
  deleteAccount,
  fetchMyCollections,
  fetchNearbyPokeLids,
  fetchPrefectureProgress,
} from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { confirmAsync } from '../../src/lib/confirm';
import { getGuestCollections, mergeGuestProgress } from '../../src/lib/guestStorage';
import { getCurrentLocation, type Coordinates } from '../../src/lib/location';
import { colors, radius, spacing, typography } from '../../src/theme';

const NEXT_TO_COLLECT_COUNT = 12;
// Over-fetch nearby candidates since some of the nearest ones may already be
// collected and get filtered out below.
const NEARBY_FETCH_COUNT = NEXT_TO_COLLECT_COUNT * 3;

interface HomeData {
  progress: ProgressDto;
  uncollected: NearbyPokeLidDto[];
}

async function loadHomeData(location: Coordinates | null): Promise<HomeData> {
  const [progressRes, guestItems, collections, nearby] = await Promise.all([
    fetchPrefectureProgress(),
    getGuestCollections(),
    fetchMyCollections(),
    fetchNearbyPokeLids(location, NEARBY_FETCH_COUNT),
  ]);

  const collectedIds = new Set([
    ...collections.map((c) => c.pokeLidId),
    ...guestItems.map((g) => g.pokeLidId),
  ]);
  const progress = guestItems.length > 0 ? mergeGuestProgress(progressRes, guestItems) : progressRes;
  const uncollected = nearby.filter((l) => !collectedIds.has(l.id)).slice(0, NEXT_TO_COLLECT_COUNT);

  return { progress, uncollected };
}

export default function PrefecturesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    getCurrentLocation().then(setLocation);
  }, []);

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
      Alert.alert('エラー', 'アカウントの削除に失敗しました');
    } finally {
      setDeletingAccount(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadHomeData(location)
        .then((result) => {
          if (!cancelled) setData(result);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // `user` isn't read in the body, but its identity changes on
      // login/logout and that's exactly when collections/guest-merge data
      // needs to be refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, location]),
  );

  const progress = data?.progress ?? null;
  const percent =
    progress && progress.totalPokeLids > 0
      ? Math.round((progress.collectedCount / progress.totalPokeLids) * 100)
      : 0;
  const nextToCollect = data?.uncollected ?? [];

  return (
    <ScreenContainer>
      <Head>
        <title>ポケふた収集</title>
      </Head>
      <FlatList
        data={progress?.byPrefecture ?? []}
        keyExtractor={(item) => String(item.prefectureId)}
        refreshing={loading}
        onRefresh={() => loadHomeData(location).then(setData)}
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
                <Button
                  title="地図で見る"
                  onPress={() => router.push('/map')}
                  variant="secondary"
                  style={styles.headerButton}
                />
                {user ? (
                  <>
                    <Button
                      title="収集記録"
                      onPress={() => router.push('/collection')}
                      variant="secondary"
                      style={styles.headerButton}
                    />
                    <Button
                      title="ログアウト"
                      onPress={() => logout()}
                      variant="ghost"
                      style={styles.headerButton}
                    />
                  </>
                ) : (
                  <Button
                    title="ログイン"
                    onPress={() => router.push('/login')}
                    variant="primary"
                    style={styles.headerButton}
                  />
                )}
              </View>
              {user && (
                <TouchableOpacity onPress={onDeleteAccount} disabled={deletingAccount}>
                  <Text style={styles.deleteAccountLink}>
                    {deletingAccount ? '削除中…' : 'アカウントを削除する'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {nextToCollect.length > 0 && (
              <View style={styles.nextSection}>
                <View style={styles.nextTitleRow}>
                  <Text style={styles.nextTitleText}>次に集めよう</Text>
                  {location && <Text style={styles.nextSortedLabel}>📍現在地から近い順</Text>}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.nextRow}
                >
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
            imageUri={item.imageUrl}
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
  deleteAccountLink: {
    ...typography.footnote,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
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
  nextSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
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
