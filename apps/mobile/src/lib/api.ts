import type {
  AuthTokensDto,
  NearbyPokeLidDto,
  PhotoMedal,
  PokeLidDto,
  ProgressDto,
  UserDto,
} from '@pokelids/shared';

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

// Fired whenever request() refreshes the access token in the background, or
// gives up because the refresh token itself was rejected. AuthProvider uses
// this to keep persisted storage (and its `user` state, on failure) in sync
// without every call site having to know about token refresh.
type TokensChangedListener = (tokens: { accessToken: string; refreshToken: string } | null) => void;
let onTokensChanged: TokensChangedListener | null = null;

export function setTokensChangedListener(fn: TokensChangedListener | null) {
  onTokensChanged = fn;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// These endpoints either issue tokens or take a refresh token directly in the
// body (no Bearer header involved), so a 401 from them is never "the access
// token expired" — retrying with a refreshed token makes no sense there and
// risks a loop.
const NO_REFRESH_RETRY_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
];

// Only one refresh should ever be in flight — screens like the home tab fire
// several requests in parallel, and if all of them 401 at once, rotating the
// refresh token once and sharing the result (rather than racing four
// rotations, where only the first would succeed) is what keeps the other
// three from failing.
let refreshingPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const result = await request<AuthTokensDto>(
      '/api/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }) },
      false,
    );
    setTokens(result);
    onTokensChanged?.(result);
    return true;
  } catch {
    setTokens(null);
    onTokensChanged?.(null);
    return false;
  }
}

function tryRefresh(): Promise<boolean> {
  refreshingPromise ??= doRefresh().finally(() => {
    refreshingPromise = null;
  });
  return refreshingPromise;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });

  if (res.status === 401 && retry && refreshToken && !NO_REFRESH_RETRY_PATHS.includes(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
  }

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

export async function deleteAccount(): Promise<void> {
  await request<void>('/api/auth/me', { method: 'DELETE' });
}

export async function logout(): Promise<void> {
  if (!refreshToken) return;
  // Best-effort: the local session is cleared regardless of whether this
  // call succeeds, so a network failure here shouldn't block logging out.
  await request<void>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {});
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

export async function fetchNearbyPokeLids(
  coordinates: { latitude: number; longitude: number } | null,
  limit: number,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (coordinates) {
    params.set('lat', String(coordinates.latitude));
    params.set('lng', String(coordinates.longitude));
  }
  return request<NearbyPokeLidDto[]>(`/api/poke-lids/nearby?${params.toString()}`);
}

export interface CollectionSummary {
  id: string;
  pokeLidId: string;
  visitedAt: string;
  notes: string | null;
  photos: {
    id: string;
    url: string;
    thumbUrl: string;
    isPrimary: boolean;
    medal: PhotoMedal;
    createdAt: string;
  }[];
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

  return request<{
    collectionId: string;
    photoId: string | null;
    visitedAt: string;
    medal: PhotoMedal | null;
  }>('/api/collections', {
    method: 'POST',
    body: form,
  });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await request<void>(`/api/collections/${collectionId}`, { method: 'DELETE' });
}

export async function updateCollectionNotes(collectionId: string, notes: string | null): Promise<void> {
  await request<void>(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

// `path` is a server-provided relative URL that already embeds a short-lived,
// photo-scoped access token (see PhotoDto.url / .thumbUrl) — this just makes
// it absolute.
export function photoUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
