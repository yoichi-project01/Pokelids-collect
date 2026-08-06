import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const progressRouter = Router();

async function buildProgress(userId: string | null) {
  // A retired lid can no longer be visited, so it's dropped from both sides
  // of the ratio (see packages/shared's countsTowardProgress) — not just the
  // total. Counting a collected-but-retired lid in collectedCount while
  // excluding it from totalPokeLids would let collected exceed total and
  // push the percentage past 100%.
  const [totalPokeLids, collectedCount, prefectures, lidCounts, representativeImages, collectedByPrefecture] =
    await Promise.all([
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

  return { totalPokeLids, collectedCount, byPrefecture };
}

// Public: browsing without login shows totals only (no personal collected count).
progressRouter.get('/', async (_req, res) => {
  res.json(await buildProgress(null));
});

progressRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await buildProgress(req.userId!));
});
