import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  haversineDistanceMeters,
  isPokeLidVisible,
  municipalityKey,
  pickMunicipalityGoals,
  progressPercent,
  regionNameJa,
  type CollectionDto,
  type PokeLidDto,
  type ProgressDto,
} from '@pokelids/shared';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { HomeMapPreview } from '../../src/components/HomeMapPreview';
import { HorizontalFadeScroll } from '../../src/components/HorizontalFadeScroll';
import { ListRow } from '../../src/components/ListRow';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ProgressBar } from '../../src/components/ProgressBar';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { fetchPrefectureProgress } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useCollections } from '../../src/lib/collections';
import { getGuestCollections, mergeGuestProgress, type GuestCollection } from '../../src/lib/guestStorage';
import {
  getCurrentLocation,
  getLocationPermissionStatus,
  openLocationSettings,
  requestLocationPermission,
  setLocationPermissionChangedListener,
  type Coordinates,
  type LocationPermissionStatus,
} from '../../src/lib/location';
import type { MapMarkerData } from '../../src/lib/mapHtml';
import { POKE_LIDS, POKE_LIDS_BY_ID } from '../../src/lib/pokeLidsData';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

// 10kmではなく、あと1つ("何が近くにあるか")を見せることに主眼を置いた範囲。
// HomeMapPreviewのバッジ、グリッドの見出しの両方で使う唯一のソース。
const NEARBY_RANGE_KM = 10;
// 件数は「列数 × 行数」で決める（固定件数だと画面幅によって行数がばらつき、
// 端数行で下端が揃わなくなるため）。2行にしたのは、実機（PC・1920px・6列）で
// 確認したうえでの判断: 6列×2行=12件がPCで「2行に収まる」という目安と一致し、
// 375px・2〜3列でも1スクロール以内に下端が来る。「もっと見る」も同じ単位
// （列数×2行）で増やす。
const GRID_ROWS_INITIAL = 2;
const GRID_ROWS_PER_PAGE = 2;
const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

interface HomeData {
  progress: ProgressDto;
  guestItems: GuestCollection[];
}

type PrefectureProgress = ProgressDto['byPrefecture'][number];

async function loadHomeData(): Promise<HomeData> {
  const [progressRes, guestItems] = await Promise.all([fetchPrefectureProgress(), getGuestCollections()]);
  const progress = guestItems.length > 0 ? mergeGuestProgress(progressRes, guestItems) : progressRes;
  return { progress, guestItems };
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

interface GridItem {
  lid: PokeLidDto;
  collected: boolean;
  distanceMeters: number | null;
}

// The grid's own home-screen redesign rationale (see this file's own big
// comment block below) — nearby, distance-sorted, collected and uncollected
// mixed together. Pure client-side computation from the bundled POKE_LIDS
// snapshot (7-7) and the already-resolved collectedIds Set: no network call,
// so switching the grid's sort axis (or paging it) never costs a request.
function buildNearbyGrid(location: Coordinates, collectedIds: Set<string>): GridItem[] {
  return POKE_LIDS.filter((l) => isPokeLidVisible(l.retiredAt, collectedIds.has(l.id)))
    .map((l) => ({
      lid: l,
      collected: collectedIds.has(l.id),
      distanceMeters: haversineDistanceMeters(location.latitude, location.longitude, l.latitude, l.longitude),
    }))
    .sort((a, b) => a.distanceMeters! - b.distanceMeters!);
}

// No-location fallback: collected only, newest visit first — "近くの" no
// longer applies with no fix to sort against (see this screen's own render
// for the different section heading this pairs with). Server records take
// precedence over a guest-local one for the same poke lid, same rule
// collection.tsx's own grid already uses.
function buildRecentGrid(collections: CollectionDto[], guestItems: GuestCollection[]): GridItem[] {
  const serverIds = new Set(collections.map((c) => c.pokeLidId));
  const records = [
    ...collections.map((c) => ({ pokeLidId: c.pokeLidId, visitedAt: c.visitedAt })),
    ...guestItems
      .filter((g) => !serverIds.has(g.pokeLidId))
      .map((g) => ({ pokeLidId: g.pokeLidId, visitedAt: g.visitedAt })),
  ];
  records.sort((a, b) => new Date(b.visitedAt).getTime() - new Date(a.visitedAt).getTime());
  return records.flatMap((r) => {
    const lid = POKE_LIDS_BY_ID.get(r.pokeLidId);
    return lid ? [{ lid, collected: true, distanceMeters: null }] : [];
  });
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

export default function HomeScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { collections, refresh: refreshCollections } = useCollections();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus | null>(null);
  // How many extra "もっと見る" pages have been revealed — not a raw item
  // count, so that resizing the window (changing `columns`, e.g. rotating a
  // tablet or resizing a browser) recomputes both the initial and per-page
  // sizes against the *current* column count rather than freezing whatever
  // was true at the first render.
  const [revealedPages, setRevealedPages] = useState(0);
  const columns = useResponsiveColumns();

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

  // Only fetches progress (for the 1-line count/percent + prefecture list +
  // "もう少しで達成") and guest-local data now — the grid itself needs
  // neither a poke-lids fetch (bundled JSON, 7-7) nor a collections fetch
  // (shared context, 7-6), so this is lighter than it looks at first glance.
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      setLoading(true);
      loadHomeData()
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
      // login/logout and that's exactly when guest-merge data needs to be
      // refetched.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user]),
  );

  // Explicit refresh — also re-fetches the shared collections context
  // (7-6's "明示的な更新手段では再取得すること").
  function onRefresh() {
    setLoading(true);
    Promise.all([loadHomeData(), refreshCollections()])
      .then(([result]) => {
        setData(result);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  const progress = data?.progress ?? null;
  const percent = progress ? progressPercent(progress.collectedCount, progress.totalPokeLids) : 0;

  const collectedIds = useMemo(
    () =>
      new Set([...collections.map((c) => c.pokeLidId), ...(data?.guestItems ?? []).map((g) => g.pokeLidId)]),
    [collections, data?.guestItems],
  );

  // The whole grid's sort axis switches on whether we have a location fix —
  // see buildNearbyGrid/buildRecentGrid's own doc comments. Both are pure,
  // synchronous, client-side computations (bundled POKE_LIDS + the already-
  // loaded collections context/guest data), so switching between them, or
  // recomputing when `collections` changes elsewhere, costs nothing over
  // the network.
  const nearbyGrid = useMemo(
    () => (location ? buildNearbyGrid(location, collectedIds) : null),
    [location, collectedIds],
  );
  const recentGrid = useMemo(
    () => buildRecentGrid(collections, data?.guestItems ?? []),
    [collections, data?.guestItems],
  );
  const gridItemsFull = nearbyGrid ?? recentGrid;
  const visibleGridCount = columns * GRID_ROWS_INITIAL + revealedPages * columns * GRID_ROWS_PER_PAGE;
  const gridItems = gridItemsFull.slice(0, visibleGridCount);
  const hasMoreGridItems = gridItemsFull.length > gridItems.length;
  const gridData = useGridData(gridItems, columns);
  // "始めたばかりのユーザーには一面グレーに見える" 対策 — 並び替え・混在の
  // ロジック自体（「近くの」という前提）は変えず、実際に見えている範囲
  // （gridItems、フルリストではない）に収集済みが1件もないときだけ、
  // Onboarding.tsxと同じ「訪れて撮影すると、色がつきます」のコピーを
  // 添える。距離を無視して収集済みを混ぜる案（背景で挙げられていたもう
  // 一方）は「近くの」の前提を崩すため見送った。
  const visibleGridAllGray = gridItems.length > 0 && gridItems.every((item) => !item.collected);

  const nearbyWithinRangeCount = useMemo(() => {
    if (!nearbyGrid) return null;
    const rangeMeters = NEARBY_RANGE_KM * 1000;
    return nearbyGrid.filter((item) => !item.collected && item.distanceMeters! <= rangeMeters).length;
  }, [nearbyGrid]);

  // HomeMapPreview's own markers — every visible poke lid nationwide (same
  // fidelity as the real map tab's useMapMarkers), not just the sliced grid
  // above — clustering handles rendering all of them cheaply, and this way
  // panning the *real* map tab afterward doesn't reveal a suspiciously
  // different pin set. canQuickRecord is always false here — 6-6's
  // quick-record button is the map tab's own job, not this preview's.
  const mapMarkers = useMemo<MapMarkerData[]>(
    () =>
      POKE_LIDS.filter((l) => isPokeLidVisible(l.retiredAt, collectedIds.has(l.id))).map((l) => ({
        id: l.id,
        lat: l.latitude,
        lng: l.longitude,
        name: `${l.municipality}｜${l.pokemonFeatured.join('・')}`,
        imageUrl: l.officialImageUrl,
        collected: collectedIds.has(l.id),
        canQuickRecord: false,
      })),
    [collectedIds],
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
        <FlatList
          data={gridData}
          key={columns}
          numColumns={columns}
          keyExtractor={gridKeyExtractor((item: GridItem) => item.lid.id)}
          refreshing={loading}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.mapSection}>
                <HomeMapPreview
                  markers={mapMarkers}
                  location={location}
                  nearbyCount={nearbyWithinRangeCount}
                  nearbyRangeKm={NEARBY_RANGE_KM}
                  onPress={() => router.push('/map')}
                />
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {progress?.collectedCount ?? 0} / {progress?.totalPokeLids ?? '—'} 箇所
                  </Text>
                  <View style={styles.percentBadge}>
                    <Text style={styles.percentBadgeText}>{percent}%</Text>
                  </View>
                </View>
                {!user && !authLoading && (
                  <Text style={styles.guestNotice}>ログインすると収集記録を保存できます</Text>
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

              {/* Skipped entirely when there's nothing to head — 0 records
                  and no location means ListEmptyComponent's own "探しに
                  行こう" EmptyState is about to render right below, and a
                  "最近の記録" heading plus a location prompt stacked on top
                  of that would just be three different framings of the same
                  "there's nothing here yet" moment competing with each
                  other. */}
              {gridItemsFull.length > 0 && (
                <View style={styles.gridTitleRow}>
                  <Text style={styles.gridTitleText}>{location ? '近くのポケふた' : '最近の記録'}</Text>
                  {location && <Text style={styles.gridSortedLabel}>📍現在地から近い順</Text>}
                </View>
              )}
              {/* 表示中の範囲に収集済みが1件もないとき（例: 記録が1件だけ
                  あり、かつ現在地がそこから遠い）、一面グレーだけが理由も
                  なく並ぶと「まだ何もない」と誤解されやすい。Onboarding
                  の導入と同じコピーで、これは意図した見た目であることを
                  補足する。 */}
              {visibleGridAllGray && <Text style={styles.grayscaleHint}>訪れて撮影すると、色がつきます</Text>}
              {!location && gridItemsFull.length > 0 && (
                <LocationPermissionCta
                  status={locationStatus}
                  onRequest={() => requestLocationPermission()}
                />
              )}
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                title="はじめての1枚を探しに行こう"
                message="地図で近くのポケふたを探して、訪れた記録を残していきましょう。"
                actionLabel="地図で探す"
                onAction={() => router.push('/map')}
              />
            ) : null
          }
          renderItem={({ item }) => {
            if (item === null) return <View style={styles.placeholder} />;
            const primaryMedal = collections
              .find((c) => c.pokeLidId === item.lid.id)
              ?.photos.find((p) => p.isPrimary)?.medal;
            const retired = item.lid.retiredAt != null;
            return (
              <PokeLidCard
                title={item.lid.municipality}
                subtitle={item.lid.pokemonFeatured.join('・')}
                imageUri={item.lid.officialImageUrl}
                collected={item.collected}
                badge={
                  retired ? (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>撤去済み</Text>
                    </View>
                  ) : primaryMedal && primaryMedal !== 'NONE' ? (
                    <Text style={styles.medal}>{MEDAL_EMOJI[primaryMedal]}</Text>
                  ) : undefined
                }
                onPress={() => router.push(`/poke-lids/${item.lid.id}`)}
              />
            );
          }}
          ListFooterComponent={
            <View>
              {hasMoreGridItems && (
                <Button
                  title="もっと見る"
                  variant="ghost"
                  onPress={() => setRevealedPages((p) => p + 1)}
                  style={styles.moreButton}
                />
              )}

              {/* 47件と長い一覧なので、グリッドより下に移した（背景参照）。
                  折りたたみ式も検討したが、位置を下げるだけで「画面の大半を
                  占める」問題自体は解消するため、開閉の状態管理・アニメー
                  ションを追加するコストに見合わないと判断した。*/}
              <View style={styles.prefectureSection}>
                <Text style={styles.prefectureSectionTitle}>都道府県一覧</Text>
                {sections.map((section) => (
                  <View key={section.title}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Text style={styles.sectionPercent}>
                        {progressPercent(section.collected, section.total)}%
                      </Text>
                    </View>
                    {section.data.map((item) => (
                      <ListRow
                        key={item.prefectureId}
                        title={item.nameJa}
                        imageUri={item.imageUrl}
                        onPress={() => router.push(`/prefectures/${item.prefectureId}`)}
                        right={
                          <View style={styles.rowProgress}>
                            <ProgressBar total={item.total} collected={item.collected} />
                          </View>
                        }
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },
  mapSection: { padding: spacing.sm },
  progressSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: { ...typography.bodyMedium, fontSize: 18 },
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
  nextSection: {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  nextRow: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },
  nextCard: { width: 96, gap: spacing.xs },
  nextImage: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.background },
  nextImagePlaceholder: { backgroundColor: colors.border },
  nextCaption: { ...typography.footnote, textAlign: 'center' },
  // "あと1つ" (7-5) — the one number on this card worth calling attention to.
  nextGoalRemaining: {
    ...typography.footnote,
    textAlign: 'center',
    color: colors.attention,
    fontWeight: '600',
  },
  gridTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  gridTitleText: { ...typography.caption, textTransform: 'uppercase' },
  gridSortedLabel: { ...typography.footnote },
  grayscaleHint: {
    ...typography.footnote,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  locationCta: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentLight,
  },
  locationCtaText: { ...typography.footnote, color: colors.accent, fontWeight: '600' },
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  medal: { fontSize: 20 },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  moreButton: { marginHorizontal: spacing.lg, marginTop: spacing.sm },
  prefectureSection: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  prefectureSectionTitle: {
    ...typography.caption,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { ...typography.caption, textTransform: 'uppercase' },
  sectionPercent: { ...typography.footnote, fontWeight: '600', color: colors.accent },
  // flex: 1 with min/max caps instead of a fixed width: 320px screens need
  // the bar to shrink so it doesn't crowd the prefecture name, and wide web
  // screens shouldn't stretch it into a thin sliver.
  rowProgress: { flex: 1, maxWidth: 160, minWidth: 80 },
});
