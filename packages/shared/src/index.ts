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
