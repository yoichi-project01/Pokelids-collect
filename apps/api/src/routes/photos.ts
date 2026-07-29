import { Router } from 'express';
import path from 'node:path';
import fsSync from 'node:fs';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

export const photosRouter = Router();

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

photosRouter.get('/:id', requireAuth, async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const absolutePath = path.join(PHOTO_STORAGE_PATH, photo.filePath);
  if (!fsSync.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Photo file missing on disk' });
  }

  res.setHeader('Content-Type', photo.mimeType);
  fsSync.createReadStream(absolutePath).pipe(res);
});
