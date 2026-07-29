import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const pokeLidsRouter = Router();

pokeLidsRouter.get('/', requireAuth, async (req, res) => {
  const prefectureId = req.query.prefectureId ? Number(req.query.prefectureId) : undefined;

  const lids = await prisma.pokeLid.findMany({
    where: prefectureId ? { prefectureId } : undefined,
    orderBy: [{ prefectureId: 'asc' }, { name: 'asc' }],
  });

  res.json(lids.map(serializePokeLid));
});

pokeLidsRouter.get('/:id', requireAuth, async (req, res) => {
  const lid = await prisma.pokeLid.findUnique({ where: { id: req.params.id } });
  if (!lid) return res.status(404).json({ error: 'Poke lid not found' });
  res.json(serializePokeLid(lid));
});

function serializePokeLid(lid: {
  id: string;
  officialRef: string | null;
  name: string;
  pokemonFeatured: string[];
  prefectureId: number;
  municipality: string;
  address: string;
  latitude: unknown;
  longitude: unknown;
  installDate: Date | null;
  officialImageUrl: string | null;
  officialSourceUrl: string;
  notes: string | null;
}) {
  return {
    id: lid.id,
    officialRef: lid.officialRef,
    name: lid.name,
    pokemonFeatured: lid.pokemonFeatured,
    prefectureId: lid.prefectureId,
    municipality: lid.municipality,
    address: lid.address,
    latitude: Number(lid.latitude),
    longitude: Number(lid.longitude),
    installDate: lid.installDate?.toISOString() ?? null,
    officialImageUrl: lid.officialImageUrl,
    officialSourceUrl: lid.officialSourceUrl,
    notes: lid.notes,
  };
}
