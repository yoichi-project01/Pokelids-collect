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
