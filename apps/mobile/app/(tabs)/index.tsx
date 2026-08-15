import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import { Image, Platform, SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  haversineDistanceMeters,
  municipalityKey,
  pickMunicipalityGoals,
  progressPercent,
  regionNameJa,
  type NearbyPokeLidDto,
  type ProgressDto,
} from '@pokelids/shared';
import { ErrorState } from '../../src/components/ErrorState';
import { HorizontalFadeScroll } from '../../src/components/HorizontalFadeScroll';
import { ListRow } from '../../src/components/ListRow';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchMyCollections, fetchNearbyPokeLids, fetchPrefectureProgress } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { getGuestCollections, mergeGuestProgress } from '../../src/lib/guestStorage';
import {
  getCurrentLocation,
  getLocationPermissionStatus,
  openLocationSettings,
  requestLocationPermission,
  setLocationPermissionChangedListener,
  type Coordinates,
  type LocationPermissionStatus,
} from '../../src/lib/location';
import { colors, radius, spacing, typography } from '../../src/theme';

const NEXT_TO_COLLECT_COUNT = 12;
// Over-fetch nearby candidates since some of the nearest ones may already be
// collected and get filtered out below. Also doubles as the pool the "今日
// 行ける範囲" stat (7-5) counts within NEARBY_RANGE_KM — a dense area could
// in principle have more than this within range, undercounting slightly,
// but this is a motivational number, not an exhaustive one.
const NEARBY_FETCH_COUNT = NEXT_TO_COLLECT_COUNT * 3;
const NEARBY_RANGE_KM = 10;

interface HomeData {
  progress: ProgressDto;
  // Unsliced — the horizontal card row below only shows the first
  // NEXT_TO_COLLECT_COUNT, but the "今日行ける範囲" stat needs the full
  // fetched set to count how many fall within NEARBY_RANGE_KM.
  uncollected: NearbyPokeLidDto[];
}

type PrefectureProgress = ProgressDto['byPrefecture'][number];

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
  const uncollected = nearby.filter((l) => !collectedIds.has(l.id));

  return { progress, uncollected };
}

function countWithinRange(uncollected: NearbyPokeLidDto[], location: Coordinates | null): number {
  if (!location) return 0;
  const rangeMeters = NEARBY_RANGE_KM * 1000;
  return uncollected.filter(
    (l) =>
      haversineDistanceMeters(location.latitude, location.longitude, l.latitude, l.longitude) <= rangeMeters,
  ).length;
}

function groupByRegion(byPrefecture: PrefectureProgress[]) {
  const sections: { title: string; total: number; collected: number; data: PrefectureProgress[] }[] = [];
  for (const pref of byPrefecture) {
    const title = regionNameJa(pref.region);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(pref);
      last.total += pref.total;
      last.collected += pref.collected;
    } else {
      sections.push({ title, total: pref.total, collected: pref.collected, data: [pref] });
    }
  }
  return sections;
}

// Denied is a dead end for requestLocationPermission — iOS/Android won't
// re-show the OS dialog once denied, so tapping "許可してください" again would
// silently do nothing. Route that case to OS settings instead (native only;
// there's no web equivalent, so that branch is guidance text, not a button).
function LocationPermissionCta({
  status,
  onRequest,
}: {
  status: LocationPermissionStatus | null;
  onRequest: () => void;
}) {
  if (status === 'denied') {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.locationCta}>
          <Text style={styles.locationCtaText}>
            📍ブラウザのサイト設定で位置情報を許可すると、近くのポケふたが表示されます
          </Text>
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.locationCta} onPress={openLocationSettings}>
        <Text style={styles.locationCtaText}>
          📍位置情報を許可すると近くのポケふたが表示されます。タップして設定を開く
        </Text>
      </TouchableOpacity>
    );
  }
  if (status === 'undetermined') {
    return (
      <TouchableOpacity style={styles.locationCta} onPress={onRequest}>
        <Text style={styles.locationCtaText}>📍近くのポケふたを表示するには位置情報を許可してください</Text>
      </TouchableOpacity>
    );
  }
  // null (still checking) or 'granted' (just waiting on a GPS fix) — no
  // action for the user to take, so no CTA.
  return null;
}

export default function PrefecturesScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus | null>(null);

  const checkLocation = useCallback(async () => {
    const status = await getLocationPermissionStatus();
    setLocationStatus(status);
    setLocation(status === 'granted' ? await getCurrentLocation() : null);
  }, []);

  // useFocusEffect rather than useEffect: re-checks on every visit to this
  // tab too, not just on mount, which is what actually shows a status
  // change soon after the user grants or denies it (there's no navigation
  // focus event for "returned from the OS settings app", but tapping
  // between tabs is a common enough thing to do right after that this still
  // catches it quickly in practice).
  useFocusEffect(
    useCallback(() => {
      void checkLocation();
      // Also re-checks immediately when permission changes elsewhere — the
      // onboarding flow's location step, or this screen's own CTA below —
      // both funnel through requestLocationPermission, which notifies this
      // listener.
      setLocationPermissionChangedListener(checkLocation);
      return () => setLocationPermissionChangedListener(null);
    }, [checkLocation]),
  );

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadHomeData(location)
        .then((result) => {
          if (cancelled) return;
          setData(result);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
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

  function onRefresh() {
    setLoading(true);
    loadHomeData(location)
      .then((result) => {
        setData(result);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const progress = data?.progress ?? null;
  const percent = progress ? progressPercent(progress.collectedCount, progress.totalPokeLids) : 0;
  const nextToCollect = (data?.uncollected ?? []).slice(0, NEXT_TO_COLLECT_COUNT);
  const nearbyWithinRangeCount = useMemo(
    () => countWithinRange(data?.uncollected ?? [], location),
    [data?.uncollected, location],
  );
  const municipalityGoals = useMemo(
    () => pickMunicipalityGoals(progress?.byMunicipality ?? [], location),
    [progress?.byMunicipality, location],
  );
  const sections = useMemo(() => groupByRegion(progress?.byPrefecture ?? []), [progress]);

  return (
    <ScreenContainer>
      <Head>
        <title>ポケふたコレクト</title>
      </Head>
      {error && !data ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.prefectureId)}
          refreshing={loading}
          onRefresh={onRefresh}
          style={styles.list}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View>
              <View style={styles.hero}>
                <Text style={styles.heroLabel}>ポケふたコレクト</Text>
                <View style={styles.heroStatRow}>
                  <Text style={styles.heroCount}>{progress?.collectedCount ?? 0}</Text>
                  <Text style={styles.heroTotal}>/ {progress?.totalPokeLids ?? '—'} 箇所</Text>
                  <View style={styles.percentBadge}>
                    <Text style={styles.percentBadgeText}>{percent}%</Text>
                  </View>
                </View>
                {progress && (
                  <ProgressBar total={progress.totalPokeLids} collected={progress.collectedCount} />
                )}
                {!user && !authLoading && (
                  <Text style={styles.guestNotice}>ログインすると収集記録を保存できます</Text>
                )}
                {location && nearbyWithinRangeCount > 0 && (
                  <Text style={styles.rangeStat}>
                    📍現在地から{NEARBY_RANGE_KM}km以内に未収集が{nearbyWithinRangeCount}個
                  </Text>
                )}
              </View>

              {municipalityGoals.length > 0 && (
                <View style={styles.nextSection}>
                  <View style={styles.nextTitleRow}>
                    <Text style={styles.nextTitleText}>もう少しで達成</Text>
                  </View>
                  <HorizontalFadeScroll contentContainerStyle={styles.nextRow}>
                    {municipalityGoals.map((goal) => (
                      <TouchableOpacity
                        key={municipalityKey(goal.prefectureId, goal.municipality)}
                        style={styles.nextCard}
                        onPress={() => router.push(`/prefectures/${goal.prefectureId}`)}
                      >
                        {goal.imageUrl ? (
                          <Image
                            source={{ uri: goal.imageUrl }}
                            style={styles.nextImage}
                            accessibilityLabel={goal.municipality}
                          />
                        ) : (
                          <View style={[styles.nextImage, styles.nextImagePlaceholder]} />
                        )}
                        <Text style={styles.nextCaption} numberOfLines={1}>
                          {goal.municipality}
                        </Text>
                        <Text style={styles.nextGoalRemaining}>あと{goal.remaining}つ</Text>
                      </TouchableOpacity>
                    ))}
                  </HorizontalFadeScroll>
                </View>
              )}

              {nextToCollect.length > 0 && (
                <View style={styles.nextSection}>
                  <View style={styles.nextTitleRow}>
                    <Text style={styles.nextTitleText}>{location ? '次に集めよう' : 'ポケふたを探す'}</Text>
                    {location && <Text style={styles.nextSortedLabel}>📍現在地から近い順</Text>}
                  </View>
                  {!location && (
                    <LocationPermissionCta
                      status={locationStatus}
                      onRequest={() => requestLocationPermission()}
                    />
                  )}
                  <HorizontalFadeScroll contentContainerStyle={styles.nextRow}>
                    {nextToCollect.map((lid) => (
                      <TouchableOpacity
                        key={lid.id}
                        style={styles.nextCard}
                        onPress={() => router.push(`/poke-lids/${lid.id}`)}
                      >
                        <Image
                          source={{ uri: lid.officialImageUrl! }}
                          style={styles.nextImage}
                          accessibilityLabel={lid.municipality}
                        />
                        <Text style={styles.nextCaption} numberOfLines={1}>
                          {lid.municipality}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </HorizontalFadeScroll>
                </View>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionPercent}>{progressPercent(section.collected, section.total)}%</Text>
            </View>
          )}
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
      )}
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
  // flexWrap: RN's Text defaults to allowFontScaling: true, so maxing out
  // the OS font size setting can make heroCount + heroTotal + percentBadge
  // wider than the screen. Wrapping lets the badge (marginLeft: 'auto')
  // drop to its own line and still hug the right edge there.
  heroStatRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs },
  heroCount: { fontSize: 40, fontWeight: '800', color: colors.textPrimary },
  heroTotal: { ...typography.body, color: colors.textSecondary, marginRight: spacing.sm },
  percentBadge: {
    marginLeft: 'auto',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  percentBadgeText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  // Was colors.danger — that's reserved for errors and destructive actions
  // (account deletion, etc.), not a plain informational nudge to log in.
  guestNotice: { ...typography.footnote, color: colors.accent },
  rangeStat: { ...typography.footnote, color: colors.accent, fontWeight: '600' },
  // flex: 1 with min/max caps instead of a fixed width: 320px screens need
  // the bar to shrink so it doesn't crowd the prefecture name, and 720px
  // (web's ScreenContainer cap) shouldn't stretch it into a thin sliver.
  rowProgress: { flex: 1, maxWidth: 160, minWidth: 80 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  sectionTitle: { ...typography.caption, textTransform: 'uppercase' },
  sectionPercent: { ...typography.footnote, fontWeight: '600', color: colors.accent },
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
  locationCta: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
  },
  locationCtaText: { ...typography.footnote, color: colors.accent, fontWeight: '600' },
  nextRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  nextCard: { width: 96, gap: spacing.xs },
  nextImage: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.background },
  nextImagePlaceholder: { backgroundColor: colors.border },
  nextCaption: { ...typography.footnote, textAlign: 'center' },
  // "あと1つ" (7-5) — the one number on this card worth calling attention to.
  // `attention` (7-6) rather than `accent`, since this is a low-urgency
  // nudge, not the screen's primary action.
  nextGoalRemaining: {
    ...typography.footnote,
    textAlign: 'center',
    color: colors.attention,
    fontWeight: '600',
  },
});
