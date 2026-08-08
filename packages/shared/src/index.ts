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
