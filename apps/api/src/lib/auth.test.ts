import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  signPhotoAccessToken,
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
