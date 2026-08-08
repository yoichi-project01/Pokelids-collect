import { describe, expect, it } from 'vitest';
import {
  buildCollectionSummary,
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

// The poke lid the caller just recorded — the fixed "you are here" point
// every nearestUncollected search below measures from.
const ORIGIN = { id: 'origin', latitude: 35.0, longitude: 135.0 };

// Fills in every field of the candidate list buildCollectionSummary takes,
// so each test only has to spell out the one or two fields it's exercising.
function candidateLid(
  overrides: Partial<{
    id: string;
    prefectureId: number;
    municipality: string;
    officialImageUrl: string | null;
    latitude: number;
    longitude: number;
    retiredAt: string | Date | null | undefined;
    collected: boolean;
  }> = {},
) {
  return {
    id: 'lid',
    prefectureId: 13,
    municipality: 'テスト市',
    officialImageUrl: null,
    latitude: 35.0,
    longitude: 135.0,
    retiredAt: null,
    collected: false,
    ...overrides,
  };
}

describe('buildCollectionSummary — prefecture tally', () => {
  it('excludes a retired poke lid from the total (denominator)', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: null }),
      candidateLid({ id: 'b', retiredAt: '2026-08-01T00:00:00.000Z' }),
    ]);
    expect(summary.prefecture.total).toBe(1);
  });

  it('keeps a retired-but-collected poke lid in collected (numerator)', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: null }),
      candidateLid({ id: 'b', retiredAt: '2026-08-01T00:00:00.000Z', collected: true }),
    ]);
    expect(summary.prefecture.collected).toBe(1);
    // Still excluded from total even though it counts toward collected —
    // this is the asymmetry the function exists to encode.
    expect(summary.prefecture.total).toBe(1);
  });

  it('passes collectedCount and prefectureId through unchanged', () => {
    const summary = buildCollectionSummary(42, 13, ORIGIN, []);
    expect(summary.collectedCount).toBe(42);
    expect(summary.prefecture.id).toBe(13);
    expect(summary.prefecture.total).toBe(0);
    expect(summary.prefecture.collected).toBe(0);
  });

  it('treats an absent retiredAt field the same as null (stale snapshot)', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [candidateLid({ id: 'a', retiredAt: undefined })]);
    expect(summary.prefecture.total).toBe(1);
  });

  it('only considers poke lids in the given prefecture, not every candidate', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'a', prefectureId: 13 }),
      candidateLid({ id: 'b', prefectureId: 14, collected: true }),
    ]);
    expect(summary.prefecture.total).toBe(1);
    expect(summary.prefecture.collected).toBe(0);
  });
});

describe('buildCollectionSummary — isFirstCollection', () => {
  it('is true exactly when collectedCount is 1', () => {
    expect(buildCollectionSummary(1, 13, ORIGIN, []).isFirstCollection).toBe(true);
  });

  it('is false when collectedCount is 0 or greater than 1', () => {
    expect(buildCollectionSummary(0, 13, ORIGIN, []).isFirstCollection).toBe(false);
    expect(buildCollectionSummary(2, 13, ORIGIN, []).isFirstCollection).toBe(false);
  });
});

describe('buildCollectionSummary — nearestUncollected (7-4)', () => {
  it('is null when there are no other poke lids at all', () => {
    expect(buildCollectionSummary(1, 13, ORIGIN, []).nearestUncollected).toBeNull();
  });

  it('excludes poke lids the user has already collected, even if nearer', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'near-collected', latitude: 35.001, longitude: 135.001, collected: true }),
      candidateLid({ id: 'far-uncollected', latitude: 36.0, longitude: 136.0, collected: false }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('far-uncollected');
  });

  it('excludes retired poke lids, even if nearer and uncollected', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({
        id: 'near-retired',
        latitude: 35.001,
        longitude: 135.001,
        retiredAt: '2026-08-01T00:00:00.000Z',
      }),
      candidateLid({ id: 'far-active', latitude: 36.0, longitude: 136.0, retiredAt: null }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('far-active');
  });

  it('selects across prefecture boundaries rather than only the origin prefecture', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'same-prefecture-far', prefectureId: 13, latitude: 37.0, longitude: 137.0 }),
      candidateLid({
        id: 'other-prefecture-near',
        prefectureId: 14,
        latitude: 35.001,
        longitude: 135.001,
      }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('other-prefecture-near');
    expect(summary.nearestUncollected?.prefectureId).toBe(14);
  });

  it('never suggests the just-recorded poke lid itself', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: ORIGIN.id, latitude: ORIGIN.latitude, longitude: ORIGIN.longitude }),
      candidateLid({ id: 'next-nearest', latitude: 35.5, longitude: 135.5 }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('next-nearest');
  });

  it('reports the haversine distance from the origin, in meters', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'nearby', latitude: 35.01, longitude: 135.0 }),
    ]);
    expect(summary.nearestUncollected?.distanceMeters).toBeCloseTo(
      haversineDistanceMeters(ORIGIN.latitude, ORIGIN.longitude, 35.01, 135.0),
      6,
    );
  });

  it('carries the municipality and image through for display', () => {
    const summary = buildCollectionSummary(1, 13, ORIGIN, [
      candidateLid({ id: 'a', municipality: '西宮市', officialImageUrl: 'https://example.com/a.png' }),
    ]);
    expect(summary.nearestUncollected).toMatchObject({
      id: 'a',
      municipality: '西宮市',
      officialImageUrl: 'https://example.com/a.png',
    });
  });
});
