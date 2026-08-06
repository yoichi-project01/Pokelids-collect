import { describe, expect, it } from 'vitest';
import {
  countsTowardProgress,
  determinePhotoMedal,
  haversineDistanceMeters,
  isPokeLidVisible,
  isValidVisitedAt,
} from './index';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistanceMeters(35.681, 139.767, 35.681, 139.767)).toBe(0);
  });

  it('returns a known distance for Tokyo Station -> Osaka Station (~400km)', () => {
    const distance = haversineDistanceMeters(35.681236, 139.767125, 34.702485, 135.495951);
    expect(distance).toBeGreaterThan(400_000);
    expect(distance).toBeLessThan(410_000);
  });

  it('is symmetric', () => {
    const a = haversineDistanceMeters(35.0, 135.0, 36.0, 136.0);
    const b = haversineDistanceMeters(36.0, 136.0, 35.0, 135.0);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('determinePhotoMedal', () => {
  const RADIUS = 200;

  it('is SILVER when there is no location data at all', () => {
    expect(determinePhotoMedal(null, RADIUS)).toBe('SILVER');
  });

  it('is GOLD when exactly at the radius boundary', () => {
    expect(determinePhotoMedal(200, RADIUS)).toBe('GOLD');
  });

  it('is GOLD when just inside the radius', () => {
    expect(determinePhotoMedal(199.99, RADIUS)).toBe('GOLD');
  });

  it('is NONE when just outside the radius', () => {
    expect(determinePhotoMedal(200.01, RADIUS)).toBe('NONE');
  });

  it('is GOLD at zero distance', () => {
    expect(determinePhotoMedal(0, RADIUS)).toBe('GOLD');
  });

  it('is NONE when far away', () => {
    expect(determinePhotoMedal(50_000, RADIUS)).toBe('NONE');
  });
});

describe('isValidVisitedAt', () => {
  const NOW = new Date('2026-08-06T00:00:00.000Z');

  it('accepts exactly the earliest allowed date (poke lid installation start)', () => {
    expect(isValidVisitedAt(new Date('2018-12-01T00:00:00.000Z'), NOW)).toBe(true);
  });

  it('rejects one second before the earliest allowed date', () => {
    expect(isValidVisitedAt(new Date('2018-11-30T23:59:59.000Z'), NOW)).toBe(false);
  });

  it('accepts exactly one day in the future (clock-skew tolerance)', () => {
    expect(isValidVisitedAt(new Date(NOW.getTime() + 24 * 60 * 60 * 1000), NOW)).toBe(true);
  });

  it('rejects two days in the future', () => {
    expect(isValidVisitedAt(new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000), NOW)).toBe(false);
  });

  it('accepts an ordinary date well within range', () => {
    expect(isValidVisitedAt(new Date('2026-01-01T00:00:00.000Z'), NOW)).toBe(true);
  });

  it('rejects an unparseable date', () => {
    expect(isValidVisitedAt(new Date('not-a-date'), NOW)).toBe(false);
  });
});

describe('countsTowardProgress', () => {
  it('is true for an active (never-retired) poke lid', () => {
    expect(countsTowardProgress(null)).toBe(true);
  });

  it('is true when the field is absent (a snapshot bundled before retiredAt existed)', () => {
    expect(countsTowardProgress(undefined)).toBe(true);
  });

  it('is false once retiredAt is set', () => {
    expect(countsTowardProgress('2026-08-01T00:00:00.000Z')).toBe(false);
    expect(countsTowardProgress(new Date('2026-08-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('isPokeLidVisible', () => {
  it('is visible when active, whether or not the viewer collected it', () => {
    expect(isPokeLidVisible(null, false)).toBe(true);
    expect(isPokeLidVisible(null, true)).toBe(true);
  });

  it('is hidden when retired and the viewer never collected it', () => {
    expect(isPokeLidVisible('2026-08-01T00:00:00.000Z', false)).toBe(false);
  });

  it('stays visible when retired if the viewer already collected it (memory is kept)', () => {
    expect(isPokeLidVisible('2026-08-01T00:00:00.000Z', true)).toBe(true);
  });

  it('treats an absent field (stale snapshot) as active regardless of collected status', () => {
    expect(isPokeLidVisible(undefined, false)).toBe(true);
  });
});
