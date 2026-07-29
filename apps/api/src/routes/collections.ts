import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import exifr from 'exifr';
import { z } from 'zod';
import { PhotoMedal } from '@prisma/client';
import { haversineDistanceMeters } from '@pokelids/shared';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const collectionsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

// Phone GPS is typically accurate to tens of meters; 200m tolerates that
// noise while still rejecting photos clearly taken elsewhere.
const GEO_VERIFY_RADIUS_METERS = 200;

async function extractPhotoExif(buffer: Buffer) {
  try {
    const [gps, dateTimeOriginal] = await Promise.all([
      exifr.gps(buffer),
      exifr.parse(buffer, ['DateTimeOriginal']),
    ]);
    return {
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      capturedAt: dateTimeOriginal?.DateTimeOriginal ?? null,
    };
  } catch {
    return { latitude: null, longitude: null, capturedAt: null };
  }
}

const createCollectionSchema = z.object({
  pokeLidId: z.string().uuid(),
  visitedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

collectionsRouter.post('/', requireAuth, upload.single('photo'), async (req: AuthedRequest, res) => {
  const parsed = createCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }

  const userId = req.userId!;
  const { pokeLidId, notes } = parsed.data;
  const visitedAt = parsed.data.visitedAt ? new Date(parsed.data.visitedAt) : new Date();

  const pokeLid = await prisma.pokeLid.findUnique({ where: { id: pokeLidId } });
  if (!pokeLid) return res.status(404).json({ error: 'Poke lid not found' });

  const collection = await prisma.collection.upsert({
    where: { userId_pokeLidId: { userId, pokeLidId } },
    update: { visitedAt, notes },
    create: { userId, pokeLidId, visitedAt, notes },
  });

  if (!req.file) {
    return res.status(201).json({
      collectionId: collection.id,
      photoId: null,
      visitedAt: collection.visitedAt.toISOString(),
      medal: null,
    });
  }

  const existingPhotoCount = await prisma.photo.count({ where: { collectionId: collection.id } });

  const exif = await extractPhotoExif(req.file.buffer);
  const hasLocation = exif.latitude !== null && exif.longitude !== null;
  const matchesPokeLid =
    hasLocation &&
    haversineDistanceMeters(
      exif.latitude!,
      exif.longitude!,
      Number(pokeLid.latitude),
      Number(pokeLid.longitude),
    ) <= GEO_VERIFY_RADIUS_METERS;
  // Gold: photo's location matches the poke lid. Silver: no location data at
  // all (can't be checked, so we don't penalize it). Otherwise no medal —
  // the photo's location contradicts the poke lid's.
  const medal = matchesPokeLid ? PhotoMedal.GOLD : hasLocation ? PhotoMedal.NONE : PhotoMedal.SILVER;

  const ext = path.extname(req.file.originalname) || '.jpg';
  const photoId = crypto.randomUUID();
  const relativePath = path.join(userId, pokeLidId, `${photoId}${ext}`);
  const absolutePath = path.join(PHOTO_STORAGE_PATH, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, req.file.buffer);

  const photo = await prisma.photo.create({
    data: {
      id: photoId,
      collectionId: collection.id,
      userId,
      filePath: relativePath,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      exifCapturedAt: exif.capturedAt,
      exifLatitude: exif.latitude,
      exifLongitude: exif.longitude,
      medal,
      isPrimary: existingPhotoCount === 0,
    },
  });

  res.status(201).json({
    collectionId: collection.id,
    photoId: photo.id,
    visitedAt: collection.visitedAt.toISOString(),
    medal: photo.medal,
  });
});

collectionsRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const collections = await prisma.collection.findMany({
    where: { userId: req.userId },
    include: { photos: true },
    orderBy: { visitedAt: 'desc' },
  });

  res.json(
    collections.map((c) => ({
      id: c.id,
      pokeLidId: c.pokeLidId,
      visitedAt: c.visitedAt.toISOString(),
      notes: c.notes,
      photos: c.photos.map((p) => ({
        id: p.id,
        url: `/api/photos/${p.id}`,
        isPrimary: p.isPrimary,
        medal: p.medal,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  );
});
