import { Platform } from 'react-native';
// Aliased: expo-file-system's own `File` class would otherwise shadow the
// DOM `File` type (what `UploadPhotoInput.webFile` below actually needs —
// the object expo-image-picker's web implementation returns), even though
// they're unrelated types that happen to share a name.
import { File as ExpoFile, UploadType } from 'expo-file-system';
import type {
  AuthTokensDto,
  CollectionDto,
  CollectionSummary,
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

export class ApiError extends Error {
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
  '/api/auth/password-reset/request',
  '/api/auth/password-reset/confirm',
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

// Returns the token's `exp` claim in epoch milliseconds, or null if the token
// can't be parsed. Uses the classic atob-based UTF-8 decode idiom rather than
// TextDecoder so this only depends on atob, which both the browser and
// Hermes provide as a global.
function decodeAccessTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

const PROACTIVE_REFRESH_MARGIN_MS = 60_000;

// request()'s retry-on-401 reuses the same RequestInit, which is fine for a
// JSON string body but risky for a photo upload's FormData — some
// environments can't re-serialize a FormData body once fetch has already
// consumed it. Call this before building a request whose body can't safely
// be resent (photo uploads, chiefly) so the token is refreshed ahead of time
// instead of relying on the retry path.
export async function ensureFreshToken(): Promise<void> {
  if (!accessToken || !refreshToken) return;
  const expiresAtMs = decodeAccessTokenExpiry(accessToken);
  if (expiresAtMs !== null && expiresAtMs - Date.now() < PROACTIVE_REFRESH_MARGIN_MS) {
    await tryRefresh();
  }
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

// 5-4. `code` and `nonce` come from googleAuth.ts's callback handling —
// `nonce` is the value stashed in sessionStorage at the start of this same
// sign-in attempt, sent back here so the server can confirm it matches the
// claim actually embedded in Google's ID token (not just trust the client).
export async function exchangeGoogleCode(code: string, nonce: string) {
  return request<AuthTokensDto & { user: UserDto }>('/api/auth/google/exchange', {
    method: 'POST',
    body: JSON.stringify({ code, nonce }),
  });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request<{ ok: true }>('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await request<void>('/api/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function requestEmailVerification(email: string): Promise<void> {
  await request<{ ok: true }>('/api/auth/verify-email/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmEmailVerification(token: string): Promise<void> {
  await request<void>('/api/auth/verify-email/confirm', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function deleteAccount(): Promise<void> {
  await request<void>('/api/auth/me', { method: 'DELETE' });
}

// 7-3. Returns an absolute, short-lived (10min), pre-authorized download URL
// — the caller opens it directly (Linking.openURL) rather than fetching it
// through this client, the same reason photoUrl() below hands back a bare
// URL instead of the image bytes: the platform's own download/share UI
// needs to drive the request, and that can't carry the Authorization header
// this module attaches to a normal request() call.
export async function requestExport(): Promise<string> {
  const { url } = await request<{ url: string }>('/api/export', { method: 'POST' });
  return `${getApiBaseUrl()}${url}`;
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

export async function fetchMyCollections() {
  if (!accessToken) return [];
  return request<CollectionDto[]>('/api/collections/me');
}

export interface UploadCollectionResult {
  collection: CollectionDto;
  summary: CollectionSummary;
}

// A picked-but-not-yet-uploaded photo. `webFile` is only present on web
// (expo-image-picker's web implementation returns a real File alongside a
// blob: uri — see readFile in its ExponentImagePicker.web.ts) and is what
// actually carries the bytes there; on web, browser FormData.append() only
// accepts a Blob/File as its value, so passing the {uri,name,type} object
// RN's own FormData polyfill expects would silently coerce to the string
// "[object Object]" and upload no image data at all.
export interface UploadPhotoInput {
  uri: string;
  name: string;
  type: string;
  webFile?: File;
}

// Parses a raw HTTP response body the same way request() does, for the two
// upload paths below that can't go through request() (they need transport
// objects — XMLHttpRequest / expo-file-system's UploadTask — that expose
// progress, which fetch does not).
function parseUploadResponse<T>(bodyText: string, status: number): T {
  const body = bodyText ? JSON.parse(bodyText) : {};
  if (status < 200 || status >= 300) {
    throw new ApiError(status, body.error ?? `Request failed with ${status}`);
  }
  return body as T;
}

function uploadViaXhr(
  url: string,
  fields: Record<string, string>,
  photo: UploadPhotoInput,
  onProgress?: (fraction: number) => void,
): Promise<UploadCollectionResult> {
  return new Promise((resolve, reject) => {
    if (!photo.webFile) {
      reject(new ApiError(0, '写真の読み込みに失敗しました'));
      return;
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append('photo', photo.webFile, photo.webFile.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      try {
        resolve(parseUploadResponse<UploadCollectionResult>(xhr.responseText, xhr.status));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'ネットワークエラーが発生しました'));
    xhr.send(form);
  });
}

async function uploadViaFileSystemTask(
  url: string,
  fields: Record<string, string>,
  photo: UploadPhotoInput,
  onProgress?: (fraction: number) => void,
): Promise<UploadCollectionResult> {
  const task = new ExpoFile(photo.uri).createUploadTask(url, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'photo',
    mimeType: photo.type,
    parameters: fields,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    onProgress: (progress) => {
      if (onProgress && progress.totalBytes > 0) onProgress(progress.bytesSent / progress.totalBytes);
    },
  });
  const result = await task.uploadAsync();
  return parseUploadResponse<UploadCollectionResult>(result.body, result.status);
}

export async function uploadCollection(
  params: {
    pokeLidId: string;
    notes?: string;
    visitedAt?: string;
    photo?: UploadPhotoInput;
  },
  onProgress?: (fraction: number) => void,
): Promise<UploadCollectionResult> {
  // The 401-retry path in request() re-sends the same RequestInit, which is
  // unsafe for a FormData/file body in some environments — refresh ahead of
  // time instead or the retry can't happen at all for the two transports
  // below (neither goes through request()).
  await ensureFreshToken();

  const fields: Record<string, string> = { pokeLidId: params.pokeLidId };
  if (params.notes) fields.notes = params.notes;
  if (params.visitedAt) fields.visitedAt = params.visitedAt;

  if (!params.photo) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return request<UploadCollectionResult>('/api/collections', { method: 'POST', body: form });
  }

  // fetch has no upload-progress API at all, so a >25MB photo on a slow
  // mobile connection can take tens of seconds with no visible movement
  // (see 4-4) — XMLHttpRequest (web) and expo-file-system's UploadTask
  // (native) both expose real byte-level progress instead.
  const url = `${getApiBaseUrl()}/api/collections`;
  return Platform.OS === 'web'
    ? uploadViaXhr(url, fields, params.photo, onProgress)
    : uploadViaFileSystemTask(url, fields, params.photo, onProgress);
}

// 7-9 phase 2.
export interface BulkUploadItem {
  pokeLidId: string;
  notes?: string;
  visitedAt?: string;
  photo: UploadPhotoInput;
}

export interface BulkUploadResultItem {
  pokeLidId: string;
  photoId?: string;
  medal?: PhotoMedal;
  error?: string;
}

export interface BulkUploadResponse {
  results: BulkUploadResultItem[];
}

function bulkItemsField(items: BulkUploadItem[]): string {
  return JSON.stringify(items.map(({ pokeLidId, notes, visitedAt }) => ({ pokeLidId, notes, visitedAt })));
}

function uploadBulkViaXhr(
  url: string,
  items: BulkUploadItem[],
  onProgress?: (fraction: number) => void,
): Promise<BulkUploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('items', bulkItemsField(items));
    for (const item of items) {
      if (!item.photo.webFile) {
        reject(new ApiError(0, '写真の読み込みに失敗しました'));
        return;
      }
      form.append('photos', item.photo.webFile, item.photo.webFile.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    // Byte-level progress within this one chunk — a bonus XHR happens to
    // give for free here, not the primary progress signal for the sync as
    // a whole (guestStorage.ts's caller reports chunk-by-chunk progress
    // across the whole sync, since that's the only granularity available
    // on native too — see uploadBulkViaFetch below).
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      try {
        resolve(parseUploadResponse<BulkUploadResponse>(xhr.responseText, xhr.status));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () => reject(new ApiError(0, 'ネットワークエラーが発生しました'));
    xhr.send(form);
  });
}

// expo-file-system's createUploadTask (used by uploadViaFileSystemTask
// above, for the single-photo route) only ever sends one file per task —
// there's no multi-file equivalent — so a genuine multi-photo request on
// native has to go through plain fetch + React Native's own FormData
// polyfill instead, which (unlike browser FormData) accepts a plain
// {uri, name, type} object directly rather than needing a real Blob/File.
// The cost is losing byte-level progress: fetch has none, and there's no
// UploadTask here to supply it either. guestStorage.ts's caller compensates
// by reporting progress per finished chunk instead, which works the same
// way regardless of platform.
async function uploadBulkViaFetch(url: string, items: BulkUploadItem[]): Promise<BulkUploadResponse> {
  const form = new FormData();
  form.append('items', bulkItemsField(items));
  for (const item of items) {
    const filePart = { uri: item.photo.uri, name: item.photo.name, type: item.photo.type };
    form.append('photos', filePart as unknown as Blob, item.photo.name);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: form,
  });
  const text = await res.text();
  return parseUploadResponse<BulkUploadResponse>(text, res.status);
}

export async function uploadCollectionsBulk(
  items: BulkUploadItem[],
  onProgress?: (fraction: number) => void,
): Promise<BulkUploadResponse> {
  if (items.length === 0) return { results: [] };
  await ensureFreshToken();
  const url = `${getApiBaseUrl()}/api/collections/bulk`;
  return Platform.OS === 'web' ? uploadBulkViaXhr(url, items, onProgress) : uploadBulkViaFetch(url, items);
}

export async function deleteCollection(collectionId: string): Promise<{ summary: CollectionSummary }> {
  return request(`/api/collections/${collectionId}`, { method: 'DELETE' });
}

export async function updateCollectionNotes(collectionId: string, notes: string | null): Promise<void> {
  await request<void>(`/api/collections/${collectionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });
}

// Both of these return the collection's full, updated state (rather than
// 204/just the changed photo) so the caller never has to re-derive which
// photo is now primary, or re-fetch to refresh its collected-count UI — the
// server, which enforces the "at most one primary" constraint and computes
// `summary`, is the source of truth for both.
export async function deleteCollectionPhoto(
  collectionId: string,
  photoId: string,
): Promise<UploadCollectionResult> {
  return request(`/api/collections/${collectionId}/photos/${photoId}`, { method: 'DELETE' });
}

export async function setPrimaryPhoto(
  collectionId: string,
  photoId: string,
): Promise<UploadCollectionResult> {
  return request(`/api/collections/${collectionId}/photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isPrimary: true }),
  });
}

// `path` is a server-provided relative URL that already embeds a short-lived,
// photo-scoped access token (see PhotoDto.url / .thumbUrl) — this just makes
// it absolute.
export function photoUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}
