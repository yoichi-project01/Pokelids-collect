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

export interface PhotoDto {
  id: string;
  url: string;
  isPrimary: boolean;
  geoVerified: boolean;
  createdAt: string;
}

export interface ProgressDto {
  totalPokeLids: number;
  collectedCount: number;
  byPrefecture: Array<{
    prefectureId: number;
    nameJa: string;
    total: number;
    collected: number;
  }>;
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
