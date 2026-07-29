import { Router } from 'express';
import path from 'node:path';
import fsSync from 'node:fs';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/auth';

export const photosRouter = Router();

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

// <Image> tags can't set an Authorization header, so this route also
// accepts the access token as a `?token=` query param.
photosRouter.get('/:id', async (req, res) => {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const token = bearer ?? (typeof req.query.token === 'string' ? req.query.token : null);
  if (!token) return res.status(401).json({ error: 'Missing access token' });
  try {
    verifyAccessToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const absolutePath = path.join(PHOTO_STORAGE_PATH, photo.filePath);
  if (!fsSync.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Photo file missing on disk' });
  }

  res.setHeader('Content-Type', photo.mimeType);
  fsSync.createReadStream(absolutePath).pipe(res);
});
