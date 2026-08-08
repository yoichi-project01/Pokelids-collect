import { Router } from 'express';
import { municipalityKey } from '@pokelids/shared';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const progressRouter = Router();

async function buildProgress(userId: string | null) {
  // A retired lid can no longer be visited, so it's dropped from both sides
  // of the ratio (see packages/shared's countsTowardProgress) — not just the
  // total. Counting a collected-but-retired lid in collectedCount while
  // excluding it from totalPokeLids would let collected exceed total and
  // push the percentage past 100%.
  const [
    totalPokeLids,
    collectedCount,
    prefectures,
    lidCounts,
    representativeImages,
    collectedByPrefecture,
    municipalityCounts,
    municipalityImages,
    collectedByMunicipality,
  ] = await Promise.all([
    prisma.pokeLid.count({ where: { retiredAt: null } }),
    userId ? prisma.collection.count({ where: { userId, pokeLid: { retiredAt: null } } }) : 0,
    prisma.prefecture.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.pokeLid.groupBy({ by: ['prefectureId'], where: { retiredAt: null }, _count: { _all: true } }),
    prisma.pokeLid.findMany({
      where: { officialImageUrl: { not: null }, retiredAt: null },
      distinct: ['prefectureId'],
      orderBy: [{ prefectureId: 'asc' }, { name: 'asc' }],
      select: { prefectureId: true, officialImageUrl: true },
    }),
    userId
      ? prisma.$queryRaw<{ prefectureId: number; count: bigint }[]>`
          SELECT pl.prefecture_id AS "prefectureId", COUNT(*) AS count
          FROM collections c
          JOIN poke_lids pl ON pl.id = c.poke_lid_id
          WHERE c.user_id = ${userId} AND pl.retired_at IS NULL
          GROUP BY pl.prefecture_id
        `
      : Promise.resolve([]),
    // 7-5: same per-prefecture shape as above, one level finer. `_avg` gives
    // a "center point" for the municipality (see MunicipalityProgressDto's
    // doc comment in packages/shared for why the mean is good enough) in the
    // same groupBy — no extra query needed for it.
    prisma.pokeLid.groupBy({
      by: ['prefectureId', 'municipality'],
      where: { retiredAt: null },
      _count: { _all: true },
      _avg: { latitude: true, longitude: true },
    }),
    prisma.pokeLid.findMany({
      where: { officialImageUrl: { not: null }, retiredAt: null },
      distinct: ['prefectureId', 'municipality'],
      orderBy: [{ prefectureId: 'asc' }, { municipality: 'asc' }, { name: 'asc' }],
      select: { prefectureId: true, municipality: true, officialImageUrl: true },
    }),
    userId
      ? prisma.$queryRaw<{ prefectureId: number; municipality: string; count: bigint }[]>`
          SELECT pl.prefecture_id AS "prefectureId", pl.municipality AS "municipality", COUNT(*) AS count
          FROM collections c
          JOIN poke_lids pl ON pl.id = c.poke_lid_id
          WHERE c.user_id = ${userId} AND pl.retired_at IS NULL
          GROUP BY pl.prefecture_id, pl.municipality
        `
      : Promise.resolve([]),
  ]);

  const totalByPrefecture = new Map(lidCounts.map((c) => [c.prefectureId, c._count._all]));
  const imageByPrefecture = new Map(representativeImages.map((r) => [r.prefectureId, r.officialImageUrl]));
  const collectedMap = new Map(collectedByPrefecture.map((c) => [c.prefectureId, Number(c.count)]));

  const byPrefecture = prefectures.map((pref) => ({
    prefectureId: pref.id,
    nameJa: pref.nameJa,
    region: pref.region,
    total: totalByPrefecture.get(pref.id) ?? 0,
    collected: collectedMap.get(pref.id) ?? 0,
    imageUrl: imageByPrefecture.get(pref.id) ?? null,
  }));

  // Keyed by municipalityKey rather than the raw municipality string — see
  // its doc comment: 府中市/伊達市/太子町 etc. exist in more than one
  // prefecture, and merging them here would leak one prefecture's collected
  // count into another's municipality card.
  const imageByMunicipality = new Map(
    municipalityImages.map((r) => [municipalityKey(r.prefectureId, r.municipality), r.officialImageUrl]),
  );
  const collectedMapByMunicipality = new Map(
    collectedByMunicipality.map((c) => [municipalityKey(c.prefectureId, c.municipality), Number(c.count)]),
  );

  const byMunicipality = municipalityCounts.map((m) => {
    const key = municipalityKey(m.prefectureId, m.municipality);
    return {
      prefectureId: m.prefectureId,
      municipality: m.municipality,
      total: m._count._all,
      collected: collectedMapByMunicipality.get(key) ?? 0,
      imageUrl: imageByMunicipality.get(key) ?? null,
      latitude: Number(m._avg.latitude ?? 0),
      longitude: Number(m._avg.longitude ?? 0),
    };
  });

  return { totalPokeLids, collectedCount, byPrefecture, byMunicipality };
}

// Public: browsing without login shows totals only (no personal collected count).
progressRouter.get('/', async (_req, res) => {
  res.json(await buildProgress(null));
});

progressRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await buildProgress(req.userId!));
});
