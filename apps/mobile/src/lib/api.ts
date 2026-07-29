import type { AuthTokensDto, PhotoMedal, PokeLidDto, ProgressDto, UserDto } from '@pokelids/shared';

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl;
  return __DEV__ ? 'http://localhost:3000' : '';
}

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `Request failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(email: string, password: string) {
  return request<AuthTokensDto & { user: UserDto }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, displayName: string) {
  return request<AuthTokensDto & { user: UserDto }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function fetchMe() {
  return request<UserDto>('/api/auth/me');
}

export async function fetchPrefectureProgress() {
  return request<ProgressDto>(accessToken ? '/api/progress/me' : '/api/progress');
}

export async function fetchPokeLids(prefectureId?: number) {
  const query = prefectureId ? `?prefectureId=${prefectureId}` : '';
  return request<PokeLidDto[]>(`/api/poke-lids${query}`);
}

export async function fetchPokeLid(id: string) {
  return request<PokeLidDto>(`/api/poke-lids/${id}`);
}

export interface CollectionSummary {
  id: string;
  pokeLidId: string;
  visitedAt: string;
  notes: string | null;
  photos: { id: string; url: string; isPrimary: boolean; medal: PhotoMedal; createdAt: string }[];
}

export async function fetchMyCollections() {
  if (!accessToken) return [];
  return request<CollectionSummary[]>('/api/collections/me');
}

export async function uploadCollection(params: {
  pokeLidId: string;
  notes?: string;
  visitedAt?: string;
  photoUri?: string;
  photoName?: string;
  photoType?: string;
}) {
  const form = new FormData();
  form.append('pokeLidId', params.pokeLidId);
  if (params.notes) form.append('notes', params.notes);
  if (params.visitedAt) form.append('visitedAt', params.visitedAt);
  if (params.photoUri) {
    form.append('photo', {
      uri: params.photoUri,
      name: params.photoName,
      type: params.photoType,
    } as unknown as Blob);
  }

  return request<{ collectionId: string; photoId: string | null; visitedAt: string; medal: PhotoMedal | null }>(
    '/api/collections',
    {
      method: 'POST',
      body: form,
    },
  );
}

export function photoUrl(photoId: string): string {
  const url = `${getApiBaseUrl()}/api/photos/${photoId}`;
  // <Image> can't set an Authorization header, so pass the token via query string.
  return accessToken ? `${url}?token=${encodeURIComponent(accessToken)}` : url;
}
