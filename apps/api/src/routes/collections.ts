import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import exifr from 'exifr';
import { z } from 'zod';
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

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  if (!req.file) {
    return res.status(400).json({ error: 'Photo file is required (field name "photo")' });
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

  const existingPhotoCount = await prisma.photo.count({ where: { collectionId: collection.id } });

  const exif = await extractPhotoExif(req.file.buffer);
  const geoVerified =
    exif.latitude !== null &&
    exif.longitude !== null &&
    haversineDistanceMeters(
      exif.latitude,
      exif.longitude,
      Number(pokeLid.latitude),
      Number(pokeLid.longitude),
    ) <= GEO_VERIFY_RADIUS_METERS;

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
      geoVerified,
      isPrimary: existingPhotoCount === 0,
    },
  });

  res.status(201).json({
    collectionId: collection.id,
    photoId: photo.id,
    visitedAt: collection.visitedAt.toISOString(),
    geoVerified: photo.geoVerified,
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
        geoVerified: p.geoVerified,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  );
});
