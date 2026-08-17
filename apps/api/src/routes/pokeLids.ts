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
    // /nearby only ever suggests places to newly go visit, so — unlike the
    // main list/detail endpoints — a retired lid is excluded outright here,
    // with no "already collected" exception to carve back out.
    where: { officialImageUrl: { not: null }, retiredAt: null },
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

// Registered before `/:id` — otherwise Express would match "version" as an
// :id. Lets apps/mobile's pokeLidsData.ts (7-7) decide whether its bundled
// snapshot has fallen behind the DB (an ETL re-scrape adding/retiring poke
// lids) without paying for the full ~230KB list on every check — this body
// is a couple dozen bytes. `updatedAt` is the latest of every row's own
// `updatedAt` (bumped by Prisma on both an ETL upsert and a 2-1
// retire/restore), the same value apps/api/scripts/dump-poke-lids.ts embeds
// into the bundled JSON it produces, so the two are directly comparable as
// plain ISO 8601 strings (lexical order == chronological order for a fixed
// UTC format) with no Date parsing needed on the client.
pokeLidsRouter.get('/version', async (_req, res) => {
  const result = await prisma.pokeLid.aggregate({ _max: { updatedAt: true } });
  const updatedAt = result._max.updatedAt?.toISOString() ?? new Date(0).toISOString();
  // Deliberately not STATIC_CACHE_CONTROL — the whole point of this route is
  // to be checked cheaply and often (every collection/map screen focus) to
  // decide whether the full list needs refetching, so serving it from a
  // stale CDN/browser cache would defeat its purpose.
  res.setHeader('Cache-Control', 'no-store');
  res.json({ updatedAt });
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
  retiredAt: Date | null;
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
    retiredAt: lid.retiredAt?.toISOString() ?? null,
    notes: lid.notes,
  };
}
