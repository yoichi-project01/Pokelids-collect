import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateEmailVerificationToken,
  generatePasswordResetToken,
  hashEmailVerificationToken,
  hashPasswordResetToken,
  signExportAccessToken,
  signPhotoAccessToken,
  verifyExportAccessToken,
  verifyPhotoAccessToken,
} from './auth';

describe('signPhotoAccessToken / verifyPhotoAccessToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a freshly-signed token for its own photo id', () => {
    const token = signPhotoAccessToken('photo-1');
    expect(verifyPhotoAccessToken('photo-1', token)).toBe(true);
  });

  it('rejects the token when checked against a different photo id', () => {
    const token = signPhotoAccessToken('photo-1');
    expect(verifyPhotoAccessToken('photo-2', token)).toBe(false);
  });

  it('rejects the token once it has expired', () => {
    const token = signPhotoAccessToken('photo-1');
    vi.setSystemTime(new Date('2026-01-01T01:00:00.000Z')); // +1h, past the 45min TTL
    expect(verifyPhotoAccessToken('photo-1', token)).toBe(false);
  });

  it('accepts the token right up until (but not after) it expires', () => {
    const token = signPhotoAccessToken('photo-1');
    vi.setSystemTime(new Date('2026-01-01T00:44:00.000Z')); // +44min, still within the 45min TTL
    expect(verifyPhotoAccessToken('photo-1', token)).toBe(true);
  });

  it('rejects a token with a tampered signature', () => {
    const token = signPhotoAccessToken('photo-1');
    const [expiresAt, signature] = token.split('.');
    const tampered = `${expiresAt}.${signature.slice(0, -1)}${signature.at(-1) === 'a' ? 'b' : 'a'}`;
    expect(verifyPhotoAccessToken('photo-1', tampered)).toBe(false);
  });

  it('rejects a token with a tampered expiry (forged extension)', () => {
    const token = signPhotoAccessToken('photo-1');
    const [, signature] = token.split('.');
    const forgedExpiry = Date.now() + 999 * 24 * 60 * 60 * 1000;
    expect(verifyPhotoAccessToken('photo-1', `${forgedExpiry}.${signature}`)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifyPhotoAccessToken('photo-1', '')).toBe(false);
    expect(verifyPhotoAccessToken('photo-1', 'not-a-token')).toBe(false);
    expect(verifyPhotoAccessToken('photo-1', 'abc.def')).toBe(false);
  });
});

describe('signExportAccessToken / verifyExportAccessToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a freshly-signed token and returns the userId it was signed for', () => {
    const token = signExportAccessToken('user-1');
    expect(verifyExportAccessToken(token)).toBe('user-1');
  });

  it('rejects the token once it has expired', () => {
    const token = signExportAccessToken('user-1');
    vi.setSystemTime(new Date('2026-01-01T00:11:00.000Z')); // +11min, past the 10min TTL
    expect(verifyExportAccessToken(token)).toBeNull();
  });

  it('accepts the token right up until (but not after) it expires', () => {
    const token = signExportAccessToken('user-1');
    vi.setSystemTime(new Date('2026-01-01T00:09:00.000Z')); // +9min, still within the 10min TTL
    expect(verifyExportAccessToken(token)).toBe('user-1');
  });

  it('rejects a token with a tampered userId (the signature no longer matches)', () => {
    const token = signExportAccessToken('user-1');
    const [, expiresAt, signature] = token.split('.');
    expect(verifyExportAccessToken(`user-2.${expiresAt}.${signature}`)).toBeNull();
  });

  it('rejects a token with a tampered signature', () => {
    const token = signExportAccessToken('user-1');
    const [userId, expiresAt, signature] = token.split('.');
    const tampered = `${userId}.${expiresAt}.${signature.slice(0, -1)}${signature.at(-1) === 'a' ? 'b' : 'a'}`;
    expect(verifyExportAccessToken(tampered)).toBeNull();
  });

  it('rejects a token with a tampered expiry (forged extension)', () => {
    const token = signExportAccessToken('user-1');
    const [userId, , signature] = token.split('.');
    const forgedExpiry = Date.now() + 999 * 24 * 60 * 60 * 1000;
    expect(verifyExportAccessToken(`${userId}.${forgedExpiry}.${signature}`)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyExportAccessToken('')).toBeNull();
    expect(verifyExportAccessToken('not-a-token')).toBeNull();
    expect(verifyExportAccessToken('abc.def')).toBeNull();
  });

  it('is never confused with a photo access token sharing the same secret', () => {
    // Two-part shape (expiresAt.signature) vs export's three-part shape
    // (userId.expiresAt.signature) — a photo token fed into
    // verifyExportAccessToken parses as userId=<expiresAt>,
    // expiresAtRaw=<signature> (not numeric), so it's rejected before the
    // HMAC comparison ever runs.
    const photoToken = signPhotoAccessToken('photo-1');
    expect(verifyExportAccessToken(photoToken)).toBeNull();
  });
});

// generatePasswordResetToken/hashPasswordResetToken only produce the token
// and its hash — the expiry/single-use/ownership checks that matter for
// security live in the `/api/auth/password-reset/*` route handlers' Prisma
// queries (findFirst filtering on usedAt/expiresAt, the transaction that
// revokes existing refresh tokens), not in a standalone pure function like
// verifyPhotoAccessToken above. Covering those would need a DB-backed
// integration test, which this repo doesn't have set up yet; that behavior
// was instead verified manually against the running API.
describe('generatePasswordResetToken / hashPasswordResetToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a token that expires about 1 hour from now', () => {
    const { expiresAt } = generatePasswordResetToken();
    expect(expiresAt.getTime() - Date.now()).toBe(60 * 60 * 1000);
  });

  it('hashes the same token deterministically', () => {
    const { token, hash } = generatePasswordResetToken();
    expect(hashPasswordResetToken(token)).toBe(hash);
  });

  it('generates unpredictable, non-colliding tokens', () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different hashes for different tokens', () => {
    expect(hashPasswordResetToken('token-a')).not.toBe(hashPasswordResetToken('token-b'));
  });
});

// generateEmailVerificationToken/hashEmailVerificationToken (5-3) — same
// scope note as generatePasswordResetToken above applies here too: the
// expiry/single-use/cross-user checks that actually matter for security
// live in the `/api/auth/verify-email/*` route handlers' Prisma queries
// (findFirst filtering on usedAt/expiresAt, the emailVerifiedAt-already-set
// check), which this repo has no DB-backed integration test setup for. That
// behavior — an expired token, a reused (usedAt-set) token, and confirming
// with a token whose account is already verified — was instead verified
// manually against the running API, matching how password-reset's own
// route-level checks were verified (see webapp/CLAUDE.md).
describe('generateEmailVerificationToken / hashEmailVerificationToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a token that expires about 24 hours from now', () => {
    const { expiresAt } = generateEmailVerificationToken();
    expect(expiresAt.getTime() - Date.now()).toBe(24 * 60 * 60 * 1000);
  });

  it('hashes the same token deterministically', () => {
    const { token, hash } = generateEmailVerificationToken();
    expect(hashEmailVerificationToken(token)).toBe(hash);
  });

  it('generates unpredictable, non-colliding tokens', () => {
    const a = generateEmailVerificationToken();
    const b = generateEmailVerificationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces different hashes for different tokens', () => {
    expect(hashEmailVerificationToken('token-a')).not.toBe(hashEmailVerificationToken('token-b'));
  });
});
