import { Router, type NextFunction, type Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import exifr from 'exifr';
import sharp from 'sharp';
import { z } from 'zod';
import { PhotoMedal } from '@prisma/client';
import {
  buildCollectionSummary,
  determinePhotoMedal,
  haversineDistanceMeters,
  isValidVisitedAt,
  type CollectionSummary,
} from '@pokelids/shared';
import { removeFileBestEffort } from '../lib/fileCleanup';
import { prisma } from '../lib/prisma';
import { signPhotoAccessToken } from '../lib/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const collectionsRouter = Router();

// Disk holding Postgres's data directory is shared with photo storage (see
// docker-compose.yml), so an unbounded upload path can take the whole
// service down, not just fill user quota. Three independent limits, each
// env-overridable with a code default:
const MAX_PHOTOS_PER_COLLECTION = Number(process.env.MAX_PHOTOS_PER_COLLECTION ?? '5');
const MAX_USER_STORAGE_BYTES = Number(process.env.MAX_USER_STORAGE_MB ?? '500') * 1024 * 1024;

// Same flavor as auth.ts's credentialRateLimit, but keyed by userId rather
// than IP: this route sits behind requireAuth (so userId is always set by
// the time this runs), and unlike login/register — where the caller isn't
// authenticated yet — IP-based keying here would let unrelated users behind
// the same carrier-grade NAT (common on Japanese mobile networks) share one
// upload budget.
const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.UPLOAD_RATE_LIMIT_PER_HOUR ?? '60'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthedRequest) => req.userId!,
});

// Client-reported filenames/extensions are attacker-controlled; only trust
// the multer-detected MIME type, and only for a fixed whitelist. Anything
// else (in particular text/html, which would run as script when served from
// our origin) is rejected before it ever reaches disk.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/webp': '.webp',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES[file.mimetype]) {
      cb(new Error('Unsupported image type'));
      return;
    }
    cb(null, true);
  },
});

function handleUpload(req: AuthedRequest, res: Response, next: NextFunction) {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid upload' });
    next();
  });
}

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

// Phone GPS is typically accurate to tens of meters; 200m tolerates that
// noise while still rejecting photos clearly taken elsewhere.
const GEO_VERIFY_RADIUS_METERS = 200;

const MAIN_IMAGE_MAX_DIMENSION = 2000;
const THUMB_DIMENSION = 320;

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

// Re-encoding via sharp also strips EXIF (including GPS) from the stored
// file, since `.rotate()` bakes in orientation and sharp only carries
// metadata through when `.withMetadata()` is explicitly requested.
async function resizeForStorage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: MAIN_IMAGE_MAX_DIMENSION,
        height: MAIN_IMAGE_MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();
  } catch {
    // Some formats (e.g. certain HEIC variants) may not be supported by the
    // installed libvips build; fall back to storing the original rather than
    // failing the whole upload.
    return buffer;
  }
}

async function generateThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: THUMB_DIMENSION, height: THUMB_DIMENSION, fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();
  } catch {
    return null;
  }
}

function thumbPathFor(relativePath: string): string {
  const ext = path.extname(relativePath);
  return `${relativePath.slice(0, -ext.length)}_thumb.jpg`;
}

// Best-effort: file removal is tried before the DB row is touched, but a
// failure here must not abort the request (see removeFileBestEffort). Same
// ordering/tolerance as 2-5's account deletion.
async function removePhotoFiles(photo: { id: string; userId: string; filePath: string }): Promise<void> {
  await Promise.all([
    removeFileBestEffort(path.join(PHOTO_STORAGE_PATH, photo.filePath), { userId: photo.userId }),
    removeFileBestEffort(path.join(PHOTO_STORAGE_PATH, thumbPathFor(photo.filePath)), {
      userId: photo.userId,
    }),
  ]);
}

function serializePhoto(photo: { id: string; isPrimary: boolean; medal: PhotoMedal; createdAt: Date }) {
  const token = signPhotoAccessToken(photo.id);
  return {
    id: photo.id,
    url: `/api/photos/${photo.id}?token=${token}`,
    thumbUrl: `/api/photos/${photo.id}?token=${token}&size=thumb`,
    isPrimary: photo.isPrimary,
    medal: photo.medal,
    createdAt: photo.createdAt.toISOString(),
  };
}

function serializeCollection(collection: {
  id: string;
  pokeLidId: string;
  visitedAt: Date;
  notes: string | null;
  photos: { id: string; isPrimary: boolean; medal: PhotoMedal; createdAt: Date }[];
}) {
  return {
    id: collection.id,
    pokeLidId: collection.pokeLidId,
    visitedAt: collection.visitedAt.toISOString(),
    notes: collection.notes,
    photos: collection.photos.map(serializePhoto),
  };
}

// Backs the `summary` field every collections mutation returns (4-4/7-4), so
// a client can update its collected-count / prefecture-progress UI — and
// now show a "next" suggestion right after recording (7-4) — from that one
// response instead of re-fetching /progress and /collections/me afterward.
//
// Fetches EVERY poke lid nationwide (not just `pokeLid`'s own prefecture),
// because buildCollectionSummary's nearest-uncollected search deliberately
// spans prefecture borders — see its doc comment for why `origin` is this
// poke lid's own DB coordinates rather than a device GPS fix. At ~500 rows
// nationwide this is still 2 cheap queries total (one for the poke lids,
// one batched query for the per-row `collections` check), the same shape
// pokeLids.ts's /nearby route already does unconditionally.
async function fetchCollectionSummary(
  userId: string,
  pokeLid: { id: string; prefectureId: number; municipality: string; latitude: unknown; longitude: unknown },
): Promise<CollectionSummary> {
  const [collectedCount, allLids] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.pokeLid.findMany({
      select: {
        id: true,
        prefectureId: true,
        municipality: true,
        officialImageUrl: true,
        latitude: true,
        longitude: true,
        retiredAt: true,
        collections: { where: { userId }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  return buildCollectionSummary(
    collectedCount,
    {
      id: pokeLid.id,
      prefectureId: pokeLid.prefectureId,
      municipality: pokeLid.municipality,
      latitude: Number(pokeLid.latitude),
      longitude: Number(pokeLid.longitude),
    },
    allLids.map((l) => ({
      id: l.id,
      prefectureId: l.prefectureId,
      municipality: l.municipality,
      officialImageUrl: l.officialImageUrl,
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
      retiredAt: l.retiredAt,
      collected: l.collections.length > 0,
    })),
  );
}

const NOTES_MAX_LENGTH = 1000;
const notesSchema = z.string().max(NOTES_MAX_LENGTH, `メモは${NOTES_MAX_LENGTH}文字以内で入力してください`);

// Guards against a wildly wrong visitedAt corrupting the collection screen's
// "first/latest record" stats and the visitedAt orderBy sort — not a
// generic freshness check, so the message names the actual valid range.
const visitedAtSchema = z
  .string()
  .datetime()
  .refine((value) => isValidVisitedAt(new Date(value), new Date()), {
    message: '訪問日は2018年12月1日から明日までの日付を指定してください',
  });

const createCollectionSchema = z.object({
  pokeLidId: z.string().uuid(),
  visitedAt: visitedAtSchema.optional(),
  notes: notesSchema.optional(),
});

// zod's flattened error details aren't meant for end users; the app surfaces
// `error` directly via showToast, so it needs to be the specific, Japanese
// message from the failing check (see notesSchema/visitedAtSchema above)
// rather than a generic string.
function firstValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request body';
}

collectionsRouter.post('/', requireAuth, uploadRateLimit, handleUpload, async (req: AuthedRequest, res) => {
  const parsed = createCollectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: firstValidationError(parsed.error), details: parsed.error.flatten() });
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
    const photos = await prisma.photo.findMany({
      where: { collectionId: collection.id },
      orderBy: { createdAt: 'asc' },
    });
    const summary = await fetchCollectionSummary(userId, pokeLid);
    return res.status(201).json({
      collection: serializeCollection({ ...collection, photos }),
      summary,
    });
  }

  const existingPhotoCount = await prisma.photo.count({ where: { collectionId: collection.id } });
  if (existingPhotoCount >= MAX_PHOTOS_PER_COLLECTION) {
    return res.status(400).json({
      error: `1件の収集記録に登録できる写真は${MAX_PHOTOS_PER_COLLECTION}枚までです。`,
    });
  }

  // Single aggregate query rather than summing fetched rows, so this stays
  // O(1) regardless of how many photos the user already has.
  const { _sum } = await prisma.photo.aggregate({
    where: { userId },
    _sum: { fileSizeBytes: true },
  });
  if ((_sum.fileSizeBytes ?? 0) + req.file.size > MAX_USER_STORAGE_BYTES) {
    return res.status(413).json({
      error: '写真の保存容量が上限に達しました。不要な写真を削除してから再度お試しください。',
    });
  }

  const exif = await extractPhotoExif(req.file.buffer);
  const hasLocation = exif.latitude !== null && exif.longitude !== null;
  const distanceMeters = hasLocation
    ? haversineDistanceMeters(
        exif.latitude!,
        exif.longitude!,
        Number(pokeLid.latitude),
        Number(pokeLid.longitude),
      )
    : null;
  const medal = determinePhotoMedal(distanceMeters, GEO_VERIFY_RADIUS_METERS) as PhotoMedal;

  const ext = ALLOWED_IMAGE_TYPES[req.file.mimetype];
  const photoId = crypto.randomUUID();
  const relativePath = path.join(userId, pokeLidId, `${photoId}${ext}`);
  const absolutePath = path.join(PHOTO_STORAGE_PATH, relativePath);

  const [storedBuffer, thumbBuffer] = await Promise.all([
    resizeForStorage(req.file.buffer),
    generateThumbnail(req.file.buffer),
  ]);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, storedBuffer);
  if (thumbBuffer) {
    await fs.writeFile(path.join(PHOTO_STORAGE_PATH, thumbPathFor(relativePath)), thumbBuffer);
  }

  await prisma.photo.create({
    data: {
      id: photoId,
      collectionId: collection.id,
      userId,
      filePath: relativePath,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSizeBytes: storedBuffer.length,
      exifCapturedAt: exif.capturedAt,
      exifDistanceMeters: distanceMeters,
      medal,
      isPrimary: existingPhotoCount === 0,
    },
  });

  // Re-fetched (rather than appending the just-created row to a prior list)
  // so `collection.photos` in the response reflects every photo the
  // collection now has, not just this request's — the client needs the full,
  // ordered list to reliably pick "the photo this request just added" (its
  // newest by createdAt).
  const photos = await prisma.photo.findMany({
    where: { collectionId: collection.id },
    orderBy: { createdAt: 'asc' },
  });
  const summary = await fetchCollectionSummary(userId, pokeLid);

  res.status(201).json({
    collection: serializeCollection({ ...collection, photos }),
    summary,
  });
});

collectionsRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const collections = await prisma.collection.findMany({
    where: { userId: req.userId },
    include: { photos: { orderBy: { createdAt: 'asc' } } },
    orderBy: { visitedAt: 'desc' },
  });

  res.json(collections.map(serializeCollection));
});

const updateNotesSchema = z.object({
  notes: notesSchema.nullable(),
});

collectionsRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateNotesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: firstValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const collection = await prisma.collection.findUnique({ where: { id: req.params.id } });
  if (!collection || collection.userId !== req.userId) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  const updated = await prisma.collection.update({
    where: { id: collection.id },
    data: { notes: parsed.data.notes },
  });

  res.json({ id: updated.id, notes: updated.notes });
});

collectionsRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const collection = await prisma.collection.findUnique({
    where: { id: req.params.id },
    include: {
      photos: true,
      pokeLid: { select: { prefectureId: true, municipality: true, latitude: true, longitude: true } },
    },
  });
  // 404 rather than 403 so the existence of another user's collection can't
  // be probed by ID.
  if (!collection || collection.userId !== req.userId) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  await Promise.all(collection.photos.map(removePhotoFiles));

  // Cascades to `photos` at the DB level (onDelete: Cascade in the schema).
  await prisma.collection.delete({ where: { id: collection.id } });

  // 200 + a summary body (was 204) so the client can update its collected
  // count without a follow-up /progress fetch — see 4-4.
  const summary = await fetchCollectionSummary(req.userId!, {
    id: collection.pokeLidId,
    ...collection.pokeLid,
  });
  res.status(200).json({ summary });
});

collectionsRouter.delete('/:id/photos/:photoId', requireAuth, async (req: AuthedRequest, res) => {
  const collection = await prisma.collection.findUnique({
    where: { id: req.params.id },
    include: {
      pokeLid: { select: { prefectureId: true, municipality: true, latitude: true, longitude: true } },
    },
  });
  // 404 rather than 403 so the existence of another user's collection can't
  // be probed by ID.
  if (!collection || collection.userId !== req.userId) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
  if (!photo || photo.collectionId !== collection.id) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  await removePhotoFiles(photo);

  const photos = await prisma.$transaction(async (tx) => {
    // Decide the promotion candidate (oldest of what's left) before
    // deleting, then delete the old primary and promote in that order — the
    // partial unique index (one_primary_per_collection) never sees two
    // primaries at once this way, only ever zero-then-one.
    const promotionCandidate = photo.isPrimary
      ? await tx.photo.findFirst({
          where: { collectionId: collection.id, id: { not: photo.id } },
          orderBy: { createdAt: 'asc' },
        })
      : null;

    await tx.photo.delete({ where: { id: photo.id } });

    if (promotionCandidate) {
      await tx.photo.update({ where: { id: promotionCandidate.id }, data: { isPrimary: true } });
    }

    return tx.photo.findMany({ where: { collectionId: collection.id }, orderBy: { createdAt: 'asc' } });
  });

  // Photo count changes, not collection count, so `summary.collectedCount`
  // and `.prefecture.collected/.total` never actually move here — but the
  // client type is shared across all four mutation endpoints (see 4-4), and
  // computing it is cheap (2 small queries), so it's included rather than
  // carving out a special-cased response shape for this one route.
  const summary = await fetchCollectionSummary(req.userId!, {
    id: collection.pokeLidId,
    ...collection.pokeLid,
  });
  res.json({ collection: serializeCollection({ ...collection, photos }), summary });
});

const setPrimaryPhotoSchema = z.object({
  isPrimary: z.literal(true),
});

collectionsRouter.patch('/:id/photos/:photoId', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = setPrimaryPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: firstValidationError(parsed.error), details: parsed.error.flatten() });
  }

  const collection = await prisma.collection.findUnique({
    where: { id: req.params.id },
    include: {
      pokeLid: { select: { prefectureId: true, municipality: true, latitude: true, longitude: true } },
    },
  });
  if (!collection || collection.userId !== req.userId) {
    return res.status(404).json({ error: 'Collection not found' });
  }

  const photo = await prisma.photo.findUnique({ where: { id: req.params.photoId } });
  if (!photo || photo.collectionId !== collection.id) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  if (!photo.isPrimary) {
    // Unset the old primary before setting the new one — the reverse order
    // would briefly have two rows with is_primary = true in the same
    // collection, which the partial unique index rejects.
    await prisma.$transaction([
      prisma.photo.updateMany({
        where: { collectionId: collection.id, isPrimary: true },
        data: { isPrimary: false },
      }),
      prisma.photo.update({ where: { id: photo.id }, data: { isPrimary: true } }),
    ]);
  }

  const photos = await prisma.photo.findMany({
    where: { collectionId: collection.id },
    orderBy: { createdAt: 'asc' },
  });
  // See the DELETE photo route above for why `summary` is included even
  // though setting a primary photo never changes these counts.
  const summary = await fetchCollectionSummary(req.userId!, {
    id: collection.pokeLidId,
    ...collection.pokeLid,
  });
  res.json({ collection: serializeCollection({ ...collection, photos }), summary });
});
