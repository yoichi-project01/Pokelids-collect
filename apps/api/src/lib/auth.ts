import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const PHOTO_TOKEN_SECRET = process.env.PHOTO_TOKEN_SECRET ?? REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '1h';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '30');
const PHOTO_TOKEN_TTL_MS = 5 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('hex');
  const hash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHmac('sha256', REFRESH_SECRET).update(token).digest('hex');
}

function signPhotoPayload(photoId: string, expiresAt: number): string {
  return crypto.createHmac('sha256', PHOTO_TOKEN_SECRET).update(`${photoId}.${expiresAt}`).digest('hex');
}

// Short-lived, photo-scoped token for use in <Image> URLs, which can't set an
// Authorization header. Scoped to a single photo ID so it can't be replayed
// against other photos, and short-lived so it doesn't linger in browser
// history / Referer headers / proxy access logs the way a long-lived access
// token would.
export function signPhotoAccessToken(photoId: string): string {
  const expiresAt = Date.now() + PHOTO_TOKEN_TTL_MS;
  return `${expiresAt}.${signPhotoPayload(photoId, expiresAt)}`;
}

export function verifyPhotoAccessToken(photoId: string, token: string): boolean {
  const [expiresAtRaw, signature] = token.split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!expiresAtRaw || !signature || Number.isNaN(expiresAt) || Date.now() > expiresAt) return false;
  const expected = signPhotoPayload(photoId, expiresAt);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  return expectedBuf.length === actualBuf.length && crypto.timingSafeEqual(expectedBuf, actualBuf);
}
