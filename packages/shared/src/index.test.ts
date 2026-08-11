import { describe, expect, it } from 'vitest';
import {
  buildCollectionSummary,
  computeCelebrationMilestone,
  countsTowardProgress,
  determinePhotoMedal,
  haversineDistanceMeters,
  isPokeLidVisible,
  isValidVisitedAt,
  municipalityKey,
  pickMunicipalityGoals,
  PREFECTURES,
  progressPercent,
  regionNameJa,
  validateCoordinates,
  type CollectionSummary,
  type MunicipalityProgressDto,
} from './index';

function municipality(overrides: Partial<MunicipalityProgressDto>): MunicipalityProgressDto {
  return {
    prefectureId: 1,
    municipality: '札幌市',
    total: 2,
    collected: 0,
    imageUrl: null,
    latitude: 43.06,
    longitude: 141.35,
    ...overrides,
  };
}

describe('progressPercent', () => {
  it('floors an all-zero state at 0%, not 1%', () => {
    expect(progressPercent(0, 481)).toBe(0);
  });

  it('rounds 1/481 up to 1% instead of the true 0.2%', () => {
    expect(progressPercent(1, 481)).toBe(1);
  });

  it('still floors a single-lid collection at 1%, not 0%', () => {
    expect(progressPercent(1, 1000)).toBe(1);
  });

  it('rounds normally once past the floor', () => {
    expect(progressPercent(240, 481)).toBe(50);
  });

  it('reaches 100% at full completion', () => {
    expect(progressPercent(481, 481)).toBe(100);
  });

  it('returns 0 for a zero total rather than dividing by zero', () => {
    expect(progressPercent(0, 0)).toBe(0);
  });
});

describe('regionNameJa', () => {
  it('converts every region code actually used by PREFECTURES', () => {
    const usedRegions = new Set(PREFECTURES.map((p) => p.region));
    for (const region of usedRegions) {
      expect(regionNameJa(region)).not.toBe(region);
    }
  });

  it('groups Okinawa under the combined 九州・沖縄 label, not a separate region', () => {
    const okinawa = PREFECTURES.find((p) => p.nameJa === '沖縄県');
    expect(regionNameJa(okinawa!.region)).toBe('九州・沖縄');
  });

  it('falls back to the raw code for an unknown region rather than throwing', () => {
    expect(regionNameJa('Mars')).toBe('Mars');
  });
});

describe('pickMunicipalityGoals', () => {
  it('excludes a municipality nobody has started, even with few remaining', () => {
    const goals = pickMunicipalityGoals(
      [municipality({ municipality: '大津市', total: 2, collected: 0 })],
      null,
    );
    expect(goals).toEqual([]);
  });

  it('includes a municipality with at least one collected and few remaining', () => {
    const goals = pickMunicipalityGoals(
      [municipality({ municipality: '鈴鹿市', total: 2, collected: 1 })],
      null,
    );
    expect(goals.map((g) => g.municipality)).toEqual(['鈴鹿市']);
  });

  it('excludes single-lid municipalities entirely', () => {
    const goals = pickMunicipalityGoals(
      [municipality({ municipality: '単独市', total: 1, collected: 1 })],
      null,
    );
    expect(goals).toEqual([]);
  });

  it('excludes municipalities already fully collected', () => {
    const goals = pickMunicipalityGoals(
      [municipality({ municipality: '達成市', total: 2, collected: 2 })],
      null,
    );
    expect(goals).toEqual([]);
  });

  it('excludes municipalities with too many remaining to be a near-term goal', () => {
    const goals = pickMunicipalityGoals(
      [municipality({ municipality: '遠い市', total: 10, collected: 1 })],
      null,
    );
    expect(goals).toEqual([]);
  });

  it('sorts by remaining count first, then distance when a location is given', () => {
    const goals = pickMunicipalityGoals(
      [
        municipality({ municipality: 'あと2つ', total: 3, collected: 1, latitude: 43.06, longitude: 141.35 }),
        municipality({
          municipality: 'あと1つ(遠い)',
          total: 2,
          collected: 1,
          latitude: 45.0,
          longitude: 141.35,
        }),
        municipality({
          municipality: 'あと1つ(近い)',
          total: 2,
          collected: 1,
          latitude: 43.07,
          longitude: 141.35,
        }),
      ],
      { latitude: 43.06, longitude: 141.35 },
    );
    expect(goals.map((g) => g.municipality)).toEqual(['あと1つ(近い)', 'あと1つ(遠い)', 'あと2つ']);
  });
});

describe('validateCoordinates', () => {
  it('passes through an ordinary coordinate pair unchanged', () => {
    expect(validateCoordinates(35.681236, 139.767125)).toEqual({
      latitude: 35.681236,
      longitude: 139.767125,
    });
  });

  it('rejects NaN latitude', () => {
    expect(validateCoordinates(NaN, 139.767125)).toBeNull();
  });

  it('rejects NaN longitude', () => {
    expect(validateCoordinates(35.681236, NaN)).toBeNull();
  });

  it('rejects Infinity', () => {
    expect(validateCoordinates(Infinity, 139.767125)).toBeNull();
    expect(validateCoordinates(35.681236, -Infinity)).toBeNull();
  });

  it('rejects latitude just past the poles', () => {
    expect(validateCoordinates(90.0001, 0)).toBeNull();
    expect(validateCoordinates(-90.0001, 0)).toBeNull();
  });

  it('rejects longitude just past the antimeridian', () => {
    expect(validateCoordinates(0, 180.0001)).toBeNull();
    expect(validateCoordinates(0, -180.0001)).toBeNull();
  });

  it('accepts the exact boundary values', () => {
    expect(validateCoordinates(90, 0)).toEqual({ latitude: 90, longitude: 0 });
    expect(validateCoordinates(-90, 0)).toEqual({ latitude: -90, longitude: 0 });
    expect(validateCoordinates(0, 180)).toEqual({ latitude: 0, longitude: 180 });
    expect(validateCoordinates(0, -180)).toEqual({ latitude: 0, longitude: -180 });
  });

  it('rejects null or undefined (missing EXIF GPS)', () => {
    expect(validateCoordinates(null, null)).toBeNull();
    expect(validateCoordinates(undefined, undefined)).toBeNull();
  });
});

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
// every nearestUncollected search below measures from. prefectureId/
// municipality match candidateLid's own defaults below, so a plain
// `candidateLid()` with no overrides lands in the same prefecture AND
// municipality as ORIGIN unless a test explicitly moves it.
const ORIGIN = { id: 'origin', prefectureId: 13, municipality: 'テスト市', latitude: 35.0, longitude: 135.0 };

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
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: null }),
      candidateLid({ id: 'b', retiredAt: '2026-08-01T00:00:00.000Z' }),
    ]);
    expect(summary.prefecture.total).toBe(1);
  });

  it('keeps a retired-but-collected poke lid in collected (numerator)', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: null }),
      candidateLid({ id: 'b', retiredAt: '2026-08-01T00:00:00.000Z', collected: true }),
    ]);
    expect(summary.prefecture.collected).toBe(1);
    // Still excluded from total even though it counts toward collected —
    // this is the asymmetry the function exists to encode.
    expect(summary.prefecture.total).toBe(1);
  });

  it('passes collectedCount and prefectureId through unchanged', () => {
    const summary = buildCollectionSummary(42, ORIGIN, []);
    expect(summary.collectedCount).toBe(42);
    expect(summary.prefecture.id).toBe(13);
    expect(summary.prefecture.total).toBe(0);
    expect(summary.prefecture.collected).toBe(0);
  });

  it('treats an absent retiredAt field the same as null (stale snapshot)', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [candidateLid({ id: 'a', retiredAt: undefined })]);
    expect(summary.prefecture.total).toBe(1);
  });

  it('only considers poke lids in the given prefecture, not every candidate', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', prefectureId: 13 }),
      candidateLid({ id: 'b', prefectureId: 14, collected: true }),
    ]);
    expect(summary.prefecture.total).toBe(1);
    expect(summary.prefecture.collected).toBe(0);
  });
});

describe('buildCollectionSummary — isFirstCollection', () => {
  it('is true exactly when collectedCount is 1', () => {
    expect(buildCollectionSummary(1, ORIGIN, []).isFirstCollection).toBe(true);
  });

  it('is false when collectedCount is 0 or greater than 1', () => {
    expect(buildCollectionSummary(0, ORIGIN, []).isFirstCollection).toBe(false);
    expect(buildCollectionSummary(2, ORIGIN, []).isFirstCollection).toBe(false);
  });
});

describe('buildCollectionSummary — nearestUncollected (7-4)', () => {
  it('is null when there are no other poke lids at all', () => {
    expect(buildCollectionSummary(1, ORIGIN, []).nearestUncollected).toBeNull();
  });

  it('excludes poke lids the user has already collected, even if nearer', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'near-collected', latitude: 35.001, longitude: 135.001, collected: true }),
      candidateLid({ id: 'far-uncollected', latitude: 36.0, longitude: 136.0, collected: false }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('far-uncollected');
  });

  it('excludes retired poke lids, even if nearer and uncollected', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
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
    const summary = buildCollectionSummary(1, ORIGIN, [
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
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: ORIGIN.id, latitude: ORIGIN.latitude, longitude: ORIGIN.longitude }),
      candidateLid({ id: 'next-nearest', latitude: 35.5, longitude: 135.5 }),
    ]);
    expect(summary.nearestUncollected?.id).toBe('next-nearest');
  });

  it('reports the haversine distance from the origin, in meters', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'nearby', latitude: 35.01, longitude: 135.0 }),
    ]);
    expect(summary.nearestUncollected?.distanceMeters).toBeCloseTo(
      haversineDistanceMeters(ORIGIN.latitude, ORIGIN.longitude, 35.01, 135.0),
      6,
    );
  });

  it('carries the municipality and image through for display', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', municipality: '西宮市', officialImageUrl: 'https://example.com/a.png' }),
    ]);
    expect(summary.nearestUncollected).toMatchObject({
      id: 'a',
      municipality: '西宮市',
      officialImageUrl: 'https://example.com/a.png',
    });
  });
});

describe('municipalityKey', () => {
  it('joins prefectureId and municipality into one string', () => {
    expect(municipalityKey(13, '府中市')).toBe('13::府中市');
  });

  it('produces different keys for the same municipality name in different prefectures', () => {
    // 府中市 exists in both Tokyo (13) and Hiroshima (34) — this is exactly
    // the case buildCollectionSummary's municipality tally must not conflate.
    expect(municipalityKey(13, '府中市')).not.toBe(municipalityKey(34, '府中市'));
  });
});

describe('buildCollectionSummary — municipality tally (7-5)', () => {
  it('excludes a retired poke lid from the municipality total', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: null }),
      candidateLid({ id: 'b', retiredAt: '2026-08-01T00:00:00.000Z' }),
    ]);
    expect(summary.municipality.total).toBe(1);
  });

  it('keeps a retired-but-collected poke lid in the municipality collected count', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'a', retiredAt: '2026-08-01T00:00:00.000Z', collected: true }),
    ]);
    expect(summary.municipality.collected).toBe(1);
    expect(summary.municipality.total).toBe(0);
  });

  it('echoes origin.prefectureId and origin.municipality unchanged', () => {
    const summary = buildCollectionSummary(1, ORIGIN, []);
    expect(summary.municipality.prefectureId).toBe(ORIGIN.prefectureId);
    expect(summary.municipality.municipality).toBe(ORIGIN.municipality);
  });

  it('only counts poke lids in the same prefecture AND municipality as origin', () => {
    const summary = buildCollectionSummary(1, ORIGIN, [
      candidateLid({ id: 'same-muni', prefectureId: 13, municipality: 'テスト市' }),
      candidateLid({ id: 'other-muni-same-pref', prefectureId: 13, municipality: '別の市' }),
      candidateLid({ id: 'same-muni-other-pref', prefectureId: 14, municipality: 'テスト市' }),
    ]);
    expect(summary.municipality.total).toBe(1);
  });

  // The exact scenario the task calls out by name: 府中市 exists in both
  // Tokyo and Hiroshima. A collection recorded in Hiroshima's 府中市 must
  // never count toward, or be satisfied by, Tokyo's 府中市 lids.
  it('does not merge same-named municipalities across different prefectures', () => {
    const hiroshimaOrigin = {
      id: 'origin',
      prefectureId: 34,
      municipality: '府中市',
      latitude: 34.0,
      longitude: 132.0,
    };
    const summary = buildCollectionSummary(1, hiroshimaOrigin, [
      candidateLid({ id: 'tokyo-fuchu-1', prefectureId: 13, municipality: '府中市', collected: true }),
      candidateLid({ id: 'tokyo-fuchu-2', prefectureId: 13, municipality: '府中市', collected: true }),
      candidateLid({
        id: 'hiroshima-fuchu-1',
        prefectureId: 34,
        municipality: '府中市',
        latitude: 34.001,
        longitude: 132.001,
        collected: false,
      }),
    ]);
    expect(summary.municipality.prefectureId).toBe(34);
    expect(summary.municipality.total).toBe(1);
    expect(summary.municipality.collected).toBe(0);
  });
});

describe('computeCelebrationMilestone', () => {
  // Fills in every field of CollectionSummary so each test only has to
  // spell out the one or two fields it's exercising.
  function summaryOf(overrides: Partial<CollectionSummary> = {}): CollectionSummary {
    return {
      collectedCount: 1,
      prefecture: { id: 28, collected: 0, total: 57 },
      municipality: { prefectureId: 28, municipality: 'テスト市', collected: 0, total: 2 },
      nearestUncollected: null,
      isFirstCollection: false,
      ...overrides,
    };
  }

  it('celebrates a completed prefecture', () => {
    const milestone = computeCelebrationMilestone(
      summaryOf({ prefecture: { id: 28, collected: 57, total: 57 } }),
    );
    expect(milestone).toBe('兵庫県コンプリート！');
  });

  it('celebrates a completed municipality with 2+ poke lids', () => {
    const milestone = computeCelebrationMilestone(
      summaryOf({ municipality: { prefectureId: 28, municipality: '西宮市', collected: 4, total: 4 } }),
    );
    expect(milestone).toBe('西宮市コンプリート！');
  });

  // The exact case buildCollectionSummary's own municipality guard exists
  // for: a single-lid municipality "completes" on every visit there, which
  // would fire this constantly and stop feeling special (91% of all
  // municipalities are single-lid — see 7-5's distribution survey).
  it('does not celebrate a "completed" single-lid municipality', () => {
    const milestone = computeCelebrationMilestone(
      summaryOf({
        municipality: { prefectureId: 28, municipality: 'ソロ町', collected: 1, total: 1 },
        collectedCount: 7,
      }),
    );
    expect(milestone).toBeNull();
  });

  it('prioritizes a completed prefecture over a completed municipality', () => {
    const milestone = computeCelebrationMilestone(
      summaryOf({
        prefecture: { id: 28, collected: 57, total: 57 },
        municipality: { prefectureId: 28, municipality: '西宮市', collected: 4, total: 4 },
      }),
    );
    expect(milestone).toBe('兵庫県コンプリート！');
  });

  it('falls back to a round-number count milestone', () => {
    const milestone = computeCelebrationMilestone(summaryOf({ collectedCount: 50 }));
    expect(milestone).toBe('50箇所達成！');
  });

  it('returns null when nothing is complete and the count is not a milestone', () => {
    const milestone = computeCelebrationMilestone(summaryOf({ collectedCount: 7 }));
    expect(milestone).toBeNull();
  });

  it('treats a prefecture with zero total as not completable (avoids a false 0/0 celebration)', () => {
    const milestone = computeCelebrationMilestone(
      summaryOf({ prefecture: { id: 28, collected: 0, total: 0 }, collectedCount: 7 }),
    );
    expect(milestone).toBeNull();
  });
});
