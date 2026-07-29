import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const progressRouter = Router();

async function buildProgress(userId: string | null) {
  const [totalPokeLids, collectedCount, prefectures] = await Promise.all([
    prisma.pokeLid.count(),
    userId ? prisma.collection.count({ where: { userId } }) : 0,
    prisma.prefecture.findMany({ orderBy: { displayOrder: 'asc' } }),
  ]);

  const byPrefecture = await Promise.all(
    prefectures.map(async (pref) => {
      const [total, collected] = await Promise.all([
        prisma.pokeLid.count({ where: { prefectureId: pref.id } }),
        userId
          ? prisma.collection.count({ where: { userId, pokeLid: { prefectureId: pref.id } } })
          : 0,
      ]);
      return { prefectureId: pref.id, nameJa: pref.nameJa, total, collected };
    }),
  );

  return { totalPokeLids, collectedCount, byPrefecture };
}

// Public: browsing without login shows totals only (no personal collected count).
progressRouter.get('/', async (_req, res) => {
  res.json(await buildProgress(null));
});

progressRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  res.json(await buildProgress(req.userId!));
});
