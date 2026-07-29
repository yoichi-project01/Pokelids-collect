export interface PrefectureDto {
  id: number;
  nameJa: string;
  nameEn: string;
  region: string;
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
