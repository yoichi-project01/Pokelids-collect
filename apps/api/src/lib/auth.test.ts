import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signPhotoAccessToken, verifyPhotoAccessToken } from './auth';

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
