import { useFocusEffect, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { buildRetrospectiveStats, regionNameJa, type PhotoMedal, type PokeLidDto } from '@pokelids/shared';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { PokeLidCard } from '../../src/components/PokeLidCard';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { photoUrl } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useCollections } from '../../src/lib/collections';
import { formatDateJST } from '../../src/lib/date';
import { getAllGuestPhotos, type GuestPhotoWithUri } from '../../src/lib/guestPhotoStorage';
import { getGuestCollections, type GuestCollection } from '../../src/lib/guestStorage';
import { getFreshPokeLids } from '../../src/lib/pokeLidsData';
import { isStoragePersisted } from '../../src/lib/storagePersistence';
import {
  GRID_CELL_PADDING,
  gridKeyExtractor,
  useGridData,
  useIsNarrowScreen,
  useResponsiveColumns,
} from '../../src/lib/useGridData';
import { colors, radius, spacing, typography } from '../../src/theme';

// Normalizes both the server's CollectionDto (real, synced records — a
// confirmed medal) and a guest's local-only records (7-9 — no server
// round trip yet, so no confirmed medal, only whichever locally-saved
// photo happens to be first) into one shape the grid can render without
// caring which kind of record it's looking at.
interface CollectionGridItem {
  id: string;
  pokeLidId: string;
  visitedAt: string;
  imageUri: string | null | undefined;
  medal: PhotoMedal | null;
  isGuest: boolean;
}

const MEDAL_EMOJI: Record<'GOLD' | 'SILVER', string> = { GOLD: '🥇', SILVER: '🥈' };

export default function CollectionScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { collections, error: collectionsError, refresh: refreshCollections } = useCollections();
  const [lidsById, setLidsById] = useState<Map<string, PokeLidDto>>(new Map());
  // Guest-local data (7-9) — kept separate from `collections`/server state
  // throughout, never merged into it, so nothing here can accidentally be
  // mistaken for a synced/confirmed record.
  const [guestCollections, setGuestCollections] = useState<GuestCollection[]>([]);
  const [guestPhotos, setGuestPhotos] = useState<GuestPhotoWithUri[]>([]);
  // Starts true (the calmer wording) rather than false, so the banner
  // doesn't flash the more cautious copy for the instant before this
  // resolves — a wrong-for-a-moment "persisted" reads as harmless, a
  // wrong-for-a-moment "not persisted" doesn't (7-10).
  const [storagePersisted, setStoragePersisted] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const columns = useResponsiveColumns();
  const isNarrow = useIsNarrowScreen();

  useEffect(() => {
    isStoragePersisted().then(setStoragePersisted);
  }, []);

  // `collections` itself now comes from the shared context (7-6) — this
  // fetches everything else the grid/stats need: lids (for municipality
  // names, images, retired badges) and guest-local data. Single function
  // used by both the focus refetch below and pull-to-refresh, so the two
  // triggers can't drift into fetching different things.
  const loadOtherData = useCallback(async () => {
    const [lidsRes, guestCollectionsRes, guestPhotosRes] = await Promise.all([
      getFreshPokeLids(),
      getGuestCollections(),
      getAllGuestPhotos(),
    ]);
    return {
      lidsById: new Map(lidsRes.map((l) => [l.id, l])),
      guestCollections: guestCollectionsRes,
      guestPhotos: guestPhotosRes,
    };
  }, []);

  // Refetch on every focus, not just on mount: this screen lives in a
  // persistent tab and never unmounts, so without this it would keep
  // showing whatever was loaded the first time the tab was opened — missing
  // guest photos added on the poke-lid detail screen, or a poke-lids version
  // bump from an ETL re-scrape. `collections` itself doesn't need this
  // anymore (7-6) — it's shared context, patched in place by every mutation
  // call site, and refreshed independently by CollectionsProvider (initial
  // load, login/logout, its own 40-minute safety timer) or by this screen's
  // own pull-to-refresh below.
  //
  // The authLoading gate (and authLoading/user in the deps below) mirrors
  // (tabs)/index.tsx and useMapMarkers.ts, and fixes a real bug: a direct
  // hard reload of /collection (not navigated to from another tab) always
  // showed the empty state, even fully logged in with real records on the
  // server. Root cause — on a cold load of a non-default tab, expo-router's
  // web output resolves the actual URL's route slightly after the tab
  // navigator's own initial mount, so the 'focus' event useFocusEffect
  // relies on can fire (or be subscribed to) before that correction lands,
  // and gets missed. (tabs)/index.tsx never hit this because it *is* the
  // default tab, so it's already focused at mount with nothing to correct.
  // Without a dependency that changes after mount, a missed focus event is
  // final — nothing re-invokes this effect until an actual subsequent
  // in-app tab switch. Depending on authLoading gives it exactly that
  // second chance: once token restoration finishes, the callback's identity
  // changes, and useFocusEffect re-runs it for an already-focused screen —
  // independent of whether the original focus event was ever caught.
  // getFreshPokeLids/getGuestCollections/getAllGuestPhotos don't themselves
  // need a token, but `user` still belongs in the deps: it's what should
  // trigger this screen's own re-render/re-evaluation around login/logout
  // (e.g. a guest's local records staying visible through that transition).
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      let cancelled = false;
      loadOtherData()
        .then((result) => {
          if (cancelled) return;
          setLidsById(result.lidsById);
          setGuestCollections(result.guestCollections);
          setGuestPhotos(result.guestPhotos);
          setError(false);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, user, loadOtherData]),
  );

  // Explicit refresh (7-6's own "明示的な更新手段では再取得すること") — the
  // one place on this screen that also re-fetches `collections`, since the
  // focus effect above deliberately doesn't.
  function onRefresh() {
    setRefreshing(true);
    Promise.all([refreshCollections(), loadOtherData()])
      .then(([, result]) => {
        setLidsById(result.lidsById);
        setGuestCollections(result.guestCollections);
        setGuestPhotos(result.guestPhotos);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setRefreshing(false));
  }

  const stats = useMemo(() => {
    if (collections.length === 0) return null;

    const prefectureIds = new Set(
      collections
        .map((c) => lidsById.get(c.pokeLidId)?.prefectureId)
        .filter((id): id is number => id != null),
    );
    const dates = collections.map((c) => new Date(c.visitedAt).getTime()).sort((a, b) => a - b);
    const firstDate = new Date(dates[0]);
    const latestDate = new Date(dates[dates.length - 1]);

    // 7-1: everything else (total distance, gold rate, completed regions,
    // longest streak, municipality count) is pure derivation from the same
    // `collections`/`lidsById` this screen already has in hand — see
    // buildRetrospectiveStats's own doc comment in packages/shared for why
    // these 5 specifically, and why "一番遠くまで行った記録" (the previous
    // 5th stat here, computed from the *device's current* location) was
    // dropped rather than kept alongside them: unlike these 5, it isn't a
    // fixed fact about the collection history, and it silently disappeared
    // whenever location permission was denied. Removing it also means this
    // screen no longer needs a location fix at all.
    const retro = buildRetrospectiveStats(
      collections.map((c) => ({
        pokeLidId: c.pokeLidId,
        visitedAt: c.visitedAt,
        medal: (c.photos.find((p) => p.isPrimary) ?? c.photos[0])?.medal ?? null,
      })),
      [...lidsById.values()],
    );

    return {
      prefectureCount: prefectureIds.size,
      firstDate,
      latestDate,
      retro,
    };
  }, [collections, lidsById]);

  // Server records take precedence over a guest-local one for the same poke
  // lid — the only way that overlap happens is stale guest data left behind
  // from before an account existed (phase 2's sync will clear it), and
  // showing both would just be a confusing duplicate card.
  const gridItems = useMemo<CollectionGridItem[]>(() => {
    const serverItems: CollectionGridItem[] = collections.map((c) => {
      const primaryPhoto = c.photos.find((p) => p.isPrimary) ?? c.photos[0];
      return {
        id: c.id,
        pokeLidId: c.pokeLidId,
        visitedAt: c.visitedAt,
        imageUri: primaryPhoto
          ? photoUrl(primaryPhoto.thumbUrl)
          : lidsById.get(c.pokeLidId)?.officialImageUrl,
        medal: primaryPhoto?.medal ?? null,
        isGuest: false,
      };
    });

    const serverPokeLidIds = new Set(collections.map((c) => c.pokeLidId));
    const guestItems: CollectionGridItem[] = guestCollections
      .filter((g) => !serverPokeLidIds.has(g.pokeLidId))
      .map((g) => {
        // A guest record can have 0–5 photos (guestPhotoStorage's
        // per-record cap) — only the first stands in for the card, same as
        // a server record's primary photo.
        const photo = guestPhotos.find((p) => p.pokeLidId === g.pokeLidId);
        return {
          id: `guest-${g.pokeLidId}`,
          pokeLidId: g.pokeLidId,
          visitedAt: g.visitedAt,
          imageUri: photo?.uri ?? lidsById.get(g.pokeLidId)?.officialImageUrl,
          // Never a confirmed medal (7-9) — see poke-lids/[id].tsx's
          // captureGuestPhoto usage for why.
          medal: null,
          isGuest: true,
        };
      });

    return [...serverItems, ...guestItems];
  }, [collections, guestCollections, guestPhotos, lidsById]);

  const gridData = useGridData(gridItems, columns);

  return (
    <ScreenContainer>
      <Head>
        <title>収集記録 - ポケふたコレクト</title>
      </Head>
      {(error || collectionsError) && gridItems.length === 0 ? (
        <ErrorState onRetry={onRefresh} />
      ) : (
        <FlatList
          data={gridData}
          key={columns}
          numColumns={columns}
          keyExtractor={gridKeyExtractor((item) => item.id)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              title="はじめての1枚を探しに行こう"
              message="地図で近くのポケふたを探して、訪れた記録を残していきましょう。"
              actionLabel="地図で探す"
              onAction={() => router.push('/map')}
            />
          }
          ListHeaderComponent={
            <>
              {guestCollections.length > 0 && (
                <View style={styles.guestBanner}>
                  <Text style={styles.guestBannerText}>
                    {storagePersisted
                      ? `${guestCollections.length}件の記録がこの端末にあります。ログインすると安全に保管されます`
                      : // Not persisted (denied or unsupported, see
                        // storagePersistence.ts) — names concrete reasons a
                        // login helps (device/browser changes), framed as
                        // what login *preserves*, not what staying a guest
                        // *risks*. Never says "消えます" (7-10).
                        `${guestCollections.length}件の記録がこの端末にあります。ログインすると、機種変更やブラウザの変更があっても記録を引き継げます`}
                  </Text>
                </View>
              )}
              {stats && (
                <View style={styles.statsCard}>
                  <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                    <Stat label="訪問した都道府県" value={`${stats.prefectureCount} / 47`} />
                    {/* Upgrades the old bare "🥇獲得数" count into the rate
                        ROADMAP.md asked for (7-1) — the count alone is still
                        right there in the value string, so nothing is lost.
                        Denominator is *photographed* records only: a
                        photo-less "訪問済み" record was never eligible for a
                        medal, so counting it against the rate would just
                        make careful photographers look worse for no reason
                        (see buildRetrospectiveStats's own doc comment). */}
                    {stats.retro.goldRate && (
                      <Stat
                        label="🥇率"
                        value={`${stats.retro.goldRate.percent}%（${stats.retro.goldRate.goldCount}/${stats.retro.goldRate.photographedCount}）`}
                      />
                    )}
                  </View>
                  <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                    <Stat label="最初の記録" value={formatDateJST(stats.firstDate)} />
                    <Stat label="最新の記録" value={formatDateJST(stats.latestDate)} />
                  </View>
                  {/* 訪問した市区町村数 always renders once there's at least
                      one record (7-5's municipalityKey — see
                      buildRetrospectiveStats — keeps a same-named
                      municipality in two prefectures from being conflated).
                      移動した総距離 needs a second point to measure to, so it
                      sits out entirely on exactly one record rather than
                      claiming "0km" — see this stat's own null case in
                      buildRetrospectiveStats. */}
                  <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                    {stats.retro.totalDistanceKm !== null && (
                      <Stat label="移動した総距離" value={`${stats.retro.totalDistanceKm.toFixed(1)}km`} />
                    )}
                    <Stat label="訪問した市区町村数" value={`${stats.retro.municipalityCount}市区町村`} />
                  </View>
                  {/* Both of these are milestone-style stats with nothing
                      motivating to show at zero (7-5's "達成不可能に見える
                      表示はしない" principle, applied here too) — the whole
                      row disappears rather than showing "0地方" or being
                      omitted with an awkward gap when neither has anything
                      to say yet. */}
                  {(stats.retro.completedRegions.length > 0 || stats.retro.longestStreakMonths !== null) && (
                    <View style={[styles.statsRow, isNarrow && styles.statsRowNarrow]}>
                      {stats.retro.completedRegions.length > 0 && (
                        <Stat
                          label="制覇した地方"
                          value={stats.retro.completedRegions.map(regionNameJa).join('・')}
                        />
                      )}
                      {stats.retro.longestStreakMonths !== null && (
                        <Stat label="最長連続記録月数" value={`${stats.retro.longestStreakMonths}ヶ月`} />
                      )}
                    </View>
                  )}
                </View>
              )}
            </>
          }
          renderItem={({ item }) => {
            if (item === null) return <View style={styles.placeholder} />;
            const lid = lidsById.get(item.pokeLidId);
            const retired = lid?.retiredAt != null;
            return (
              <PokeLidCard
                title={lid?.municipality ?? '（不明）'}
                subtitle={formatDateJST(item.visitedAt)}
                imageUri={item.imageUri}
                collected
                badge={
                  retired ? (
                    <View style={styles.retiredBadge}>
                      <Text style={styles.retiredBadgeText}>撤去済み</Text>
                    </View>
                  ) : item.medal && item.medal !== 'NONE' ? (
                    <Text style={styles.medal}>{MEDAL_EMOJI[item.medal]}</Text>
                  ) : undefined
                }
                onPress={() => lid && router.push(`/poke-lids/${lid.id}`)}
              />
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { padding: spacing.sm },
  // Matches PokeLidCard's own outer flex/padding so a trailing placeholder
  // cell takes up exactly as much row width as a real card would.
  placeholder: { flex: 1, padding: GRID_CELL_PADDING },
  medal: { fontSize: 20 },
  // attention (7-9), not danger — nothing has gone wrong, this is a nudge,
  // not an error. Deliberately plain (no border/icon) so it reads as a
  // standing notice rather than a dismissible warning.
  guestBanner: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    margin: spacing.sm,
    marginBottom: 0,
  },
  guestBannerText: {
    ...typography.footnote,
    color: colors.attention,
    fontWeight: '600',
    textAlign: 'center',
  },
  retiredBadge: {
    backgroundColor: colors.textSecondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  retiredBadgeText: { color: colors.white, fontSize: 10, fontWeight: '600' },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    margin: spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: spacing.lg },
  // Below THREE_COLUMN_MIN_WIDTH a 2-column stat card leaves ~130px per
  // cell — not enough for values like "82%（12/15）" or, worst case, a
  // completedRegions list of several region names joined with "・" — so
  // stack to one column instead of shrinking further.
  statsRowNarrow: { flexDirection: 'column', gap: spacing.md },
  stat: { flex: 1 },
  statValue: { ...typography.bodyMedium, fontSize: 18 },
  statLabel: { ...typography.footnote },
});
