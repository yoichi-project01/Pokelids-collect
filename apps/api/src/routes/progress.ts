import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const progressRouter = Router();

progressRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const [totalPokeLids, collectedCount, prefectures] = await Promise.all([
    prisma.pokeLid.count(),
    prisma.collection.count({ where: { userId } }),
    prisma.prefecture.findMany({ orderBy: { displayOrder: 'asc' } }),
  ]);

  const byPrefecture = await Promise.all(
    prefectures.map(async (pref) => {
      const [total, collected] = await Promise.all([
        prisma.pokeLid.count({ where: { prefectureId: pref.id } }),
        prisma.collection.count({ where: { userId, pokeLid: { prefectureId: pref.id } } }),
      ]);
      return { prefectureId: pref.id, nameJa: pref.nameJa, total, collected };
    }),
  );

  res.json({ totalPokeLids, collectedCount, byPrefecture });
});
