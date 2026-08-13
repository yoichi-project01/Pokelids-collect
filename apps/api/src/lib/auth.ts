import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const PHOTO_TOKEN_SECRET = process.env.PHOTO_TOKEN_SECRET ?? REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? '1h';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '30');
// Short enough that a leaked/intercepted reset email is only exploitable for
// a narrow window; long enough that a user reading their inbox doesn't race
// against it.
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
// Longer than the reset TTL on purpose (5-3): confirming an address is a
// much lower-stakes action than resetting a password (nothing sensitive is
// exposed or changed by clicking the link late), so there's no reason to
// force the same tight window — someone who registers on a trip and only
// checks email that evening should still find the link valid.
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
// The token is embedded once into a page's collections response and reused
// by <Image> for as long as that page stays open, so it needs to outlast a
// normal viewing session, not just the initial page load. It's still scoped
// to a single photo ID, so a longer TTL doesn't meaningfully widen exposure.
const PHOTO_TOKEN_TTL_MS = 45 * 60 * 1000;
// 7-3. Unlike a photo token (embedded in a page and reused for as long as
// that page stays open), an export token is meant to be used once, right
// after POST /api/export mints it — the client immediately navigates to the
// download URL. Short enough that a link sitting in browser history / a
// proxy access log stops working quickly; long enough to survive the client
// actually issuing the follow-up request.
const EXPORT_TOKEN_TTL_MS = 10 * 60 * 1000;

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

// Same shape as generateRefreshToken/hashRefreshToken: a random token whose
// HMAC is stored in the DB, so a database leak alone can't be used to reset
// anyone's password.
export function generatePasswordResetToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  return { token, hash, expiresAt };
}

export function hashPasswordResetToken(token: string): string {
  return crypto.createHmac('sha256', REFRESH_SECRET).update(token).digest('hex');
}

// Same shape again, this time for 5-3's email verification — a distinct
// pair of functions (not a shared `generateOpaqueToken(ttl)` helper) so each
// token kind keeps its own named TTL constant and hash function, matching
// generatePasswordResetToken/hashPasswordResetToken's own precedent. Hashed
// with the same HMAC key (REFRESH_SECRET) as the other token kinds here —
// what makes these token types non-interchangeable is that each is only
// ever looked up against its own table (EmailVerificationToken vs
// PasswordResetToken vs RefreshToken), not a different secret per kind.
export function generateEmailVerificationToken(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = hashEmailVerificationToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  return { token, hash, expiresAt };
}

export function hashEmailVerificationToken(token: string): string {
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

function signExportPayload(userId: string, expiresAt: number): string {
  return crypto.createHmac('sha256', PHOTO_TOKEN_SECRET).update(`${userId}.${expiresAt}`).digest('hex');
}

// Same HMAC-signed-short-lived-token shape as signPhotoAccessToken, applied
// to GET /api/export/download instead of <Image> — that route is opened via
// direct navigation (Linking.openURL on native, a plain link on web) so it
// can't carry an Authorization header either. Reuses PHOTO_TOKEN_SECRET
// rather than a third secret constant, the same way RefreshToken/
// PasswordResetToken/EmailVerificationToken already share REFRESH_SECRET
// above — safe because the token *shapes* differ (this one is
// `userId.expiresAt.signature`, three parts; a photo token is
// `expiresAt.signature`, two), so one can never be mistaken for the other
// even under a shared key. Unlike verifyPhotoAccessToken, the userId isn't
// known ahead of time from a URL path segment — it's the very thing this
// route needs to learn, so it travels inside the token itself and comes
// back out of verification rather than being passed in.
export function signExportAccessToken(userId: string): string {
  const expiresAt = Date.now() + EXPORT_TOKEN_TTL_MS;
  return `${userId}.${expiresAt}.${signExportPayload(userId, expiresAt)}`;
}

// Returns the authorized userId on success, or null — never throws, so
// callers can treat any failure (malformed, expired, tampered) uniformly as
// "not authorized" without a try/catch.
export function verifyExportAccessToken(token: string): string | null {
  const [userId, expiresAtRaw, signature] = token.split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!userId || !expiresAtRaw || !signature || Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    return null;
  }
  const expected = signExportPayload(userId, expiresAt);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }
  return userId;
}
