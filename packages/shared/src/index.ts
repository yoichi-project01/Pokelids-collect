export interface PrefectureDto {
  id: number;
  nameJa: string;
  nameEn: string;
  region: string;
}

// Static — the 47 prefectures never change. Lets clients that only need the
// name/region (e.g. a page title) skip a network round trip for what's
// effectively build-time data.
export const PREFECTURES: readonly PrefectureDto[] = [
  { id: 1, nameJa: '北海道', nameEn: 'Hokkaido', region: 'Hokkaido' },
  { id: 2, nameJa: '青森県', nameEn: 'Aomori', region: 'Tohoku' },
  { id: 3, nameJa: '岩手県', nameEn: 'Iwate', region: 'Tohoku' },
  { id: 4, nameJa: '宮城県', nameEn: 'Miyagi', region: 'Tohoku' },
  { id: 5, nameJa: '秋田県', nameEn: 'Akita', region: 'Tohoku' },
  { id: 6, nameJa: '山形県', nameEn: 'Yamagata', region: 'Tohoku' },
  { id: 7, nameJa: '福島県', nameEn: 'Fukushima', region: 'Tohoku' },
  { id: 8, nameJa: '茨城県', nameEn: 'Ibaraki', region: 'Kanto' },
  { id: 9, nameJa: '栃木県', nameEn: 'Tochigi', region: 'Kanto' },
  { id: 10, nameJa: '群馬県', nameEn: 'Gunma', region: 'Kanto' },
  { id: 11, nameJa: '埼玉県', nameEn: 'Saitama', region: 'Kanto' },
  { id: 12, nameJa: '千葉県', nameEn: 'Chiba', region: 'Kanto' },
  { id: 13, nameJa: '東京都', nameEn: 'Tokyo', region: 'Kanto' },
  { id: 14, nameJa: '神奈川県', nameEn: 'Kanagawa', region: 'Kanto' },
  { id: 15, nameJa: '新潟県', nameEn: 'Niigata', region: 'Chubu' },
  { id: 16, nameJa: '富山県', nameEn: 'Toyama', region: 'Chubu' },
  { id: 17, nameJa: '石川県', nameEn: 'Ishikawa', region: 'Chubu' },
  { id: 18, nameJa: '福井県', nameEn: 'Fukui', region: 'Chubu' },
  { id: 19, nameJa: '山梨県', nameEn: 'Yamanashi', region: 'Chubu' },
  { id: 20, nameJa: '長野県', nameEn: 'Nagano', region: 'Chubu' },
  { id: 21, nameJa: '岐阜県', nameEn: 'Gifu', region: 'Chubu' },
  { id: 22, nameJa: '静岡県', nameEn: 'Shizuoka', region: 'Chubu' },
  { id: 23, nameJa: '愛知県', nameEn: 'Aichi', region: 'Chubu' },
  { id: 24, nameJa: '三重県', nameEn: 'Mie', region: 'Kansai' },
  { id: 25, nameJa: '滋賀県', nameEn: 'Shiga', region: 'Kansai' },
  { id: 26, nameJa: '京都府', nameEn: 'Kyoto', region: 'Kansai' },
  { id: 27, nameJa: '大阪府', nameEn: 'Osaka', region: 'Kansai' },
  { id: 28, nameJa: '兵庫県', nameEn: 'Hyogo', region: 'Kansai' },
  { id: 29, nameJa: '奈良県', nameEn: 'Nara', region: 'Kansai' },
  { id: 30, nameJa: '和歌山県', nameEn: 'Wakayama', region: 'Kansai' },
  { id: 31, nameJa: '鳥取県', nameEn: 'Tottori', region: 'Chugoku' },
  { id: 32, nameJa: '島根県', nameEn: 'Shimane', region: 'Chugoku' },
  { id: 33, nameJa: '岡山県', nameEn: 'Okayama', region: 'Chugoku' },
  { id: 34, nameJa: '広島県', nameEn: 'Hiroshima', region: 'Chugoku' },
  { id: 35, nameJa: '山口県', nameEn: 'Yamaguchi', region: 'Chugoku' },
  { id: 36, nameJa: '徳島県', nameEn: 'Tokushima', region: 'Shikoku' },
  { id: 37, nameJa: '香川県', nameEn: 'Kagawa', region: 'Shikoku' },
  { id: 38, nameJa: '愛媛県', nameEn: 'Ehime', region: 'Shikoku' },
  { id: 39, nameJa: '高知県', nameEn: 'Kochi', region: 'Shikoku' },
  { id: 40, nameJa: '福岡県', nameEn: 'Fukuoka', region: 'Kyushu' },
  { id: 41, nameJa: '佐賀県', nameEn: 'Saga', region: 'Kyushu' },
  { id: 42, nameJa: '長崎県', nameEn: 'Nagasaki', region: 'Kyushu' },
  { id: 43, nameJa: '熊本県', nameEn: 'Kumamoto', region: 'Kyushu' },
  { id: 44, nameJa: '大分県', nameEn: 'Oita', region: 'Kyushu' },
  { id: 45, nameJa: '宮崎県', nameEn: 'Miyazaki', region: 'Kyushu' },
  { id: 46, nameJa: '鹿児島県', nameEn: 'Kagoshima', region: 'Kyushu' },
  { id: 47, nameJa: '沖縄県', nameEn: 'Okinawa', region: 'Kyushu' },
];

// PrefectureDto.region (and everything derived from it, e.g. ProgressDto's
// byPrefecture[].region) is an English code — convenient as a stable grouping
// key, but wrong to render as-is in a Japanese-language UI. Okinawa is
// grouped under 'Kyushu' rather than having its own region, matching the
// common "九州・沖縄地方" convention, so that's rendered as one combined label.
const REGION_NAMES_JA: Readonly<Record<string, string>> = {
  Hokkaido: '北海道',
  Tohoku: '東北',
  Kanto: '関東',
  Chubu: '中部',
  Kansai: '近畿',
  Chugoku: '中国',
  Shikoku: '四国',
  Kyushu: '九州・沖縄',
};

// Falls back to the raw code for a region that isn't in the map above rather
// than throwing — safer for a display-only helper than crashing a screen
// over a label mismatch.
export function regionNameJa(region: string): string {
  return REGION_NAMES_JA[region] ?? region;
}

export interface PokeLidDto {
  id: string;
  officialRef: string | null;
  name: string;
  pokemonFeatured: string[];
  prefectureId: number;
  municipality: string;
  address: string;
  latitude: number;
  longitude: number;
  installDate: string | null;
  officialImageUrl: string | null;
  officialSourceUrl: string;
  notes: string | null;
  // Set once the ETL no longer finds this poke lid on the official site.
  // Absent from a stale bundled snapshot predating this field — callers
  // should compare with `!= null` (not `!==`) so `undefined` there is
  // treated the same as "not retired".
  retiredAt: string | null;
}

export interface CollectionDto {
  id: string;
  pokeLidId: string;
  visitedAt: string;
  notes: string | null;
  photos: PhotoDto[];
}

export type PhotoMedal = 'GOLD' | 'SILVER' | 'NONE';

export interface PhotoDto {
  id: string;
  url: string;
  thumbUrl: string;
  isPrimary: boolean;
  medal: PhotoMedal;
  createdAt: string;
}

// `municipality` is a plain string, and the same name legitimately exists in
// multiple prefectures (府中市: Tokyo & Hiroshima; 伊達市: Hokkaido &
// Fukushima; 太子町: Hyogo & Osaka — all present in this app's own data).
// `prefectureId` + `municipality` together are the only safe unique key —
// never group or look up by `municipality` alone. This helper exists so
// that key is built exactly one way everywhere (API aggregation, client-side
// matching, tests).
export function municipalityKey(prefectureId: number, municipality: string): string {
  return `${prefectureId}::${municipality}`;
}

export interface ProgressDto {
  totalPokeLids: number;
  collectedCount: number;
  byPrefecture: Array<{
    prefectureId: number;
    nameJa: string;
    region: string;
    total: number;
    collected: number;
    imageUrl: string | null;
  }>;
  // Every (prefectureId, municipality) pair with at least one non-retired
  // poke lid — not pre-filtered to "close to complete" candidates, so the
  // client can decide its own threshold (7-5's home-screen shelf) without a
  // second request. ~400 rows nationwide; small enough to send in full.
  byMunicipality: MunicipalityProgressDto[];
}

export interface MunicipalityProgressDto {
  prefectureId: number;
  municipality: string;
  total: number;
  collected: number;
  imageUrl: string | null;
  // Mean of this municipality's own poke lid coordinates — poke lids in the
  // same municipality cluster tightly in practice (e.g. Yokohama's 5 are all
  // within its central wards), so this is a good enough "you'd head roughly
  // here" point for distance sorting without needing per-lid coordinates on
  // the client.
  latitude: number;
  longitude: number;
}

// A near-term goal (7-5): at least 2 poke lids (see pickMunicipalityGoals for
// why) and few enough left that visiting is realistic this week, not
// "someday".
export const MUNICIPALITY_GOAL_MAX_REMAINING = 3;
export const MUNICIPALITY_GOAL_COUNT = 5;

export interface MunicipalityGoal extends MunicipalityProgressDto {
  remaining: number;
  distanceMeters: number | null;
}

// "あと1つ" municipalities, nearest first when a location is known. Excludes
// single-lid municipalities entirely: per the 7-5 distribution survey, 91%
// of municipalities have exactly one poke lid, where "remaining" is always
// indistinguishable from "haven't visited yet" — no different from what
// nearestUncollected (see buildCollectionSummary) already surfaces. Without
// this filter, this shelf would just be a second copy of "次に集めよう"
// wearing a municipality name.
// Also requires collected >= 1 — a municipality nobody has started ("あと2つ"
// on 0/2) isn't "もう少しで達成", it's just untouched, and showing it here
// undercuts the shelf's whole promise. If that leaves nothing, the caller is
// expected to hide the section entirely (7-5's "don't show an empty goal"
// rule) rather than render it with zero cards — this function just returns
// an empty array in that case.
export function pickMunicipalityGoals(
  byMunicipality: MunicipalityProgressDto[],
  location: { latitude: number; longitude: number } | null,
): MunicipalityGoal[] {
  const candidates: MunicipalityGoal[] = byMunicipality
    .filter((m) => m.total >= 2 && m.collected >= 1)
    .map((m) => ({
      ...m,
      remaining: m.total - m.collected,
      distanceMeters: location
        ? haversineDistanceMeters(location.latitude, location.longitude, m.latitude, m.longitude)
        : null,
    }))
    // "残り10個の市を出しても意味がない" — only genuinely near-term goals.
    .filter((m) => m.remaining > 0 && m.remaining <= MUNICIPALITY_GOAL_MAX_REMAINING);

  candidates.sort((a, b) => {
    if (a.remaining !== b.remaining) return a.remaining - b.remaining;
    if (a.distanceMeters !== null && b.distanceMeters !== null) return a.distanceMeters - b.distanceMeters;
    return a.municipality.localeCompare(b.municipality, 'ja');
  });

  return candidates.slice(0, MUNICIPALITY_GOAL_COUNT);
}

// Rounds to a whole percent, but never down to 0 once the user has actually
// collected something — a plain Math.round(1/481*100) gives 0%, and a first
// record landing on the exact same "0%" the screen showed before anyone had
// collected anything reads as if nothing happened. Collected and total both
// being real progress counts (not free-form floats), any nonzero collected
// count is real progress worth a visible "1%" floor.
export function progressPercent(collected: number, total: number): number {
  if (total <= 0) return 0;
  const rounded = Math.round((collected / total) * 100);
  return collected > 0 ? Math.max(rounded, 1) : rounded;
}

// The single nearest poke lid a user hasn't collected yet, surfaced right
// after they complete a record (7-4) so "found one" turns into "there are
// more". Minimal on purpose — enough to render a thumbnail + caption + tap
// target (matches the existing NearbyPokeLidDto card convention on the home
// screen), not a full PokeLidDto.
export interface NearestUncollectedPokeLid {
  id: string;
  municipality: string;
  prefectureId: number;
  officialImageUrl: string | null;
  distanceMeters: number;
}

// Returned alongside every collections mutation (create, delete, photo
// delete/promote) so a client can update its "collected count" / prefecture
// progress UI from that single response instead of re-fetching /progress
// and /collections/me afterward.
export interface CollectionSummary {
  collectedCount: number;
  prefecture: {
    id: number;
    collected: number;
    total: number;
  };
  // The municipality of the poke lid this mutation touched (7-5). Sibling of
  // `prefecture` rather than flattened, same reasoning as that field.
  municipality: {
    prefectureId: number;
    municipality: string;
    collected: number;
    total: number;
  };
  // null when every non-retired poke lid nationwide is already collected —
  // callers must handle this (no "next" card to show), not treat it as
  // exceptional.
  nearestUncollected: NearestUncollectedPokeLid | null;
  // True once this mutation leaves the user with exactly one collection.
  // Drives the "全国に481箇所あります" line (7-4 item 3) — someone on their
  // very first record doesn't yet know the scale of what they just found,
  // but showing it on every subsequent record would just be noise.
  isFirstCollection: boolean;
}

// One poke lid nationwide, carrying everything buildCollectionSummary needs:
// its own prefecture's total/collected tally (filtered to `prefectureId`)
// AND the nearest-uncollected search (which deliberately is NOT filtered to
// one prefecture — see buildCollectionSummary's `origin` doc comment).
// Kept minimal/structural (no id-based lookups, no other fields) so the
// caller can hand this pure function whatever shape it already fetched.
interface PokeLidSummaryCandidate {
  id: string;
  prefectureId: number;
  municipality: string;
  officialImageUrl: string | null;
  latitude: number;
  longitude: number;
  retiredAt: string | Date | null | undefined;
  collected: boolean;
}

// `total` excludes retired lids (same rule as progress.ts's buildProgress —
// a retired lid can no longer be visited, so it drops out of "how many are
// there to collect"). `collected` does NOT exclude them: a collection record
// is a memory of a real visit, and losing it from the count just because the
// lid was later retired would contradict 2-1's "撤去済みでも収集済みの記録
// は残す" policy. This asymmetry is exactly why it's a separate, tested
// function rather than inline filtering at each call site. Applies to both
// `prefecture` and `municipality` below.
//
// `origin` is the poke lid that was just recorded — its OWN DB coordinates
// and location fields, not the device's current GPS fix (7-4). Deliberate:
//   - a user who has denied location permission still gets a "next" — the
//     home screen's "次に集めよう" already degrades to prefecture order for
//     them, and precisely those users most need to discover "there's more"
//     some other way
//   - whoever triggered this just took a photo standing at the poke lid, so
//     its coordinates ARE their current location, to within the same margin
//   - poke lids sit near buildings/underground passages where a live GPS fix
//     can be off by tens to hundreds of meters; the DB coordinate is exact
//   - no extra data has to travel from the client to compute it
// `nearestUncollected` search deliberately spans every prefecture (not just
// `origin.prefectureId`) — a lid just across a prefecture border can be the
// genuinely closest one. `municipality` below is matched by
// `prefectureId` + `municipality` together (see municipalityKey's doc
// comment) — matching on the string alone would merge same-named
// municipalities in different prefectures.
export function buildCollectionSummary(
  collectedCount: number,
  origin: { id: string; prefectureId: number; municipality: string; latitude: number; longitude: number },
  allLids: PokeLidSummaryCandidate[],
): CollectionSummary {
  const prefectureLids = allLids.filter((l) => l.prefectureId === origin.prefectureId);
  const municipalityLids = prefectureLids.filter((l) => l.municipality === origin.municipality);

  let nearestUncollected: NearestUncollectedPokeLid | null = null;
  let nearestDistance = Infinity;
  for (const lid of allLids) {
    if (lid.id === origin.id) continue;
    if (lid.collected) continue;
    if (!countsTowardProgress(lid.retiredAt)) continue;
    const distanceMeters = haversineDistanceMeters(
      origin.latitude,
      origin.longitude,
      lid.latitude,
      lid.longitude,
    );
    if (distanceMeters < nearestDistance) {
      nearestDistance = distanceMeters;
      nearestUncollected = {
        id: lid.id,
        municipality: lid.municipality,
        prefectureId: lid.prefectureId,
        officialImageUrl: lid.officialImageUrl,
        distanceMeters,
      };
    }
  }

  return {
    collectedCount,
    prefecture: {
      id: origin.prefectureId,
      collected: prefectureLids.filter((l) => l.collected).length,
      total: prefectureLids.filter((l) => countsTowardProgress(l.retiredAt)).length,
    },
    municipality: {
      prefectureId: origin.prefectureId,
      municipality: origin.municipality,
      collected: municipalityLids.filter((l) => l.collected).length,
      total: municipalityLids.filter((l) => countsTowardProgress(l.retiredAt)).length,
    },
    nearestUncollected,
    isFirstCollection: collectedCount === 1,
  };
}

// Round-number milestones for the "N箇所達成" celebration. Starting with a
// handful of well-spaced values (not every 10) so it stays a genuine treat
// rather than firing constantly — tune this list based on how it actually
// feels in use.
const MILESTONE_COUNTS = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450];

// The celebration text (if any) for a just-completed collections mutation —
// shared between the poke-lid detail screen's upload flow and the map's
// quick-record flow (6-6), which both need the exact same priority logic.
// Checked in order, first match wins:
//   1. Prefecture complete — the rarest, biggest achievement.
//   2. Municipality complete, but only when it has 2+ poke lids. A
//      single-lid municipality "completes" on every visit there (91% of all
//      municipalities are single-lid — see 7-5's distribution survey), which
//      would fire this constantly and stop feeling special.
//   3. A round-number total count milestone.
// Returns null when none apply — callers should treat that as "no
// milestone", not an error.
export function computeCelebrationMilestone(summary: CollectionSummary): string | null {
  const { prefecture, municipality } = summary;
  if (prefecture.total > 0 && prefecture.collected === prefecture.total) {
    const prefName = PREFECTURES.find((p) => p.id === prefecture.id)?.nameJa ?? '';
    return `${prefName}コンプリート！`;
  }
  if (municipality.total >= 2 && municipality.collected === municipality.total) {
    return `${municipality.municipality}コンプリート！`;
  }
  if (MILESTONE_COUNTS.includes(summary.collectedCount)) {
    return `${summary.collectedCount}箇所達成！`;
  }
  return null;
}

export interface NearbyPokeLidDto {
  id: string;
  municipality: string;
  prefectureId: number;
  officialImageUrl: string | null;
  latitude: number;
  longitude: number;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

// Guards against invalid GPS coordinates reaching haversineDistanceMeters,
// which happily returns NaN (or a nonsense distance) for bad input rather
// than erroring. `?? null` alone (the pattern both apps/api's and
// apps/mobile's EXIF extraction used before this) only catches
// null/undefined — NaN sails right through, since `NaN ?? null` is NaN, not
// null. exifr can produce NaN GPS values on its own: some Android camera/
// gallery apps write a GPSLatitude/GPSLongitude tag as an incomplete
// degrees/minutes/seconds rational array (missing the seconds component),
// and exifr's DMS-to-decimal conversion doesn't validate array length
// before doing the arithmetic — a missing component is `undefined`, and
// `undefined / 3600` is NaN, which then propagates through the whole sum.
// (A *missing* GPSLatitudeRef/GPSLongitudeRef, by contrast, does NOT
// produce NaN in exifr — it silently defaults to positive/N-E instead,
// which happens to be correct for this app's userbase since Japan is
// entirely N/E anyway, so that particular exifr quirk isn't a real-world
// problem here.)
//
// The single source of truth for "is this coordinate pair usable at all,"
// shared by apps/api's and apps/mobile's EXIF extraction — previously
// these two independently reimplemented (and one of them was documented as
// merely "mirroring" the other) the same `?? null` logic, which is exactly
// how a shared bug like this stays a *shared* bug instead of one place
// noticing and the other not.
export function validateCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number; longitude: number } | null {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Gold: photo's location is within `radiusMeters` of the poke lid. Silver: no
// location data at all (can't be checked, so it isn't penalized). Otherwise
// no medal — the photo's location contradicts the poke lid's.
export function determinePhotoMedal(distanceMeters: number | null, radiusMeters: number): PhotoMedal {
  if (distanceMeters === null) return 'SILVER';
  return distanceMeters <= radiusMeters ? 'GOLD' : 'NONE';
}

// Client-side gate for the map's "写真を撮って記録" quick-record button
// (6-6): only shown when the device's live GPS position is within this
// distance of a poke lid's own coordinates.
//
// This is numerically the same 200m as apps/api/src/routes/collections.ts's
// GEO_VERIFY_RADIUS_METERS, but deliberately a SEPARATE constant, not one
// shared between server and client — because the two answer different
// questions, checked against different data:
//   - GEO_VERIFY_RADIUS_METERS asks "did the photo actually get taken
//     there?", checked server-side against the photo's own EXIF GPS, after
//     the fact.
//   - QUICK_RECORD_RADIUS_METERS asks "is this device standing there right
//     now?", checked client-side against a live GPS fix, before a photo even
//     exists.
// Because the measurements come from different sensors at different
// moments, they can legitimately disagree: a phone's live fix might read
// 180m (button shows) while the photo's own EXIF — captured moments later,
// with a different fix — comes back at 220m server-side (SILVER/NONE, not
// GOLD). Showing this button is never a promise of a medal.
// Keeping them separate also means this one can be loosened or tightened
// from real outdoor use (a GPS fix indoors/underground/between buildings can
// easily be off by 100m+) without ever touching the medal threshold, which
// should stay stable once users are relying on it to mean something.
export const QUICK_RECORD_RADIUS_METERS = 200;

// No poke lid was installed before this date; a Collection.visitedAt earlier
// than it can only be bad client input, and would otherwise corrupt the
// collection screen's "first/latest record" stats and the orderBy sort.
export const EARLIEST_VISITED_AT: Date = new Date('2018-12-01T00:00:00.000Z');

// A client's clock can run fast; tolerate up to a day of skew rather than
// rejecting an otherwise-genuine "just visited" record.
export const VISITED_AT_FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function isValidVisitedAt(visitedAt: Date, now: Date): boolean {
  if (Number.isNaN(visitedAt.getTime())) return false;
  if (visitedAt.getTime() < EARLIEST_VISITED_AT.getTime()) return false;
  return visitedAt.getTime() <= now.getTime() + VISITED_AT_FUTURE_TOLERANCE_MS;
}

// A retired poke lid can no longer be visited, so it shouldn't count toward
// the "still collectible" universe — the progress denominator, and (for
// someone who hasn't already collected it) general browsing surfaces. See
// isPokeLidVisible below for the display-side exception to that.
// `undefined` is accepted alongside `null` so a client-bundled snapshot
// taken before this field existed is treated the same as "not retired"
// rather than as a type error.
export function countsTowardProgress(retiredAt: string | Date | null | undefined): boolean {
  return retiredAt == null;
}

// Whether a poke lid should appear in browse/discovery surfaces (the poke
// lid list, map, /nearby) for a given viewer. A retired lid stays visible
// only if the viewer already holds a collection record for it — the
// physical manhole is gone, but that isn't a reason to erase the user's own
// memory of having been there.
export function isPokeLidVisible(
  retiredAt: string | Date | null | undefined,
  hasCollected: boolean,
): boolean {
  return countsTowardProgress(retiredAt) || hasCollected;
}
