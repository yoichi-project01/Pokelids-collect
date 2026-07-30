import { Router } from 'express';
import { haversineDistanceMeters } from '@pokelids/shared';
import { prisma } from '../lib/prisma';

export const pokeLidsRouter = Router();

const STATIC_CACHE_CONTROL = 'public, max-age=3600';

// Registered before `/:id` — otherwise Express would match "nearby" as an :id.
pokeLidsRouter.get('/nearby', async (req, res) => {
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const limit = Math.min(Number(req.query.limit ?? 12) || 12, 100);

  const lids = await prisma.pokeLid.findMany({
    where: { officialImageUrl: { not: null } },
    select: {
      id: true,
      municipality: true,
      prefectureId: true,
      officialImageUrl: true,
      latitude: true,
      longitude: true,
    },
  });

  const withCoords = lids.map((l) => ({
    ...l,
    latitude: Number(l.latitude),
    longitude: Number(l.longitude),
  }));

  const sorted =
    lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)
      ? withCoords.sort(
          (a, b) =>
            haversineDistanceMeters(lat, lng, a.latitude, a.longitude) -
            haversineDistanceMeters(lat, lng, b.latitude, b.longitude),
        )
      : withCoords.sort(
          (a, b) => a.prefectureId - b.prefectureId || a.municipality.localeCompare(b.municipality),
        );

  res.json(sorted.slice(0, limit));
});

pokeLidsRouter.get('/', async (req, res) => {
  const prefectureId = req.query.prefectureId ? Number(req.query.prefectureId) : undefined;

  const lids = await prisma.pokeLid.findMany({
    where: prefectureId ? { prefectureId } : undefined,
    orderBy: [{ prefectureId: 'asc' }, { name: 'asc' }],
  });

  res.setHeader('Cache-Control', STATIC_CACHE_CONTROL);
  res.json(lids.map(serializePokeLid));
});

pokeLidsRouter.get('/:id', async (req, res) => {
  const lid = await prisma.pokeLid.findUnique({ where: { id: req.params.id } });
  if (!lid) return res.status(404).json({ error: 'Poke lid not found' });
  res.setHeader('Cache-Control', STATIC_CACHE_CONTROL);
  res.json(serializePokeLid(lid));
});

export function serializePokeLid(lid: {
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
