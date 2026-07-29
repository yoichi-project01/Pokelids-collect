import { Router } from 'express';
import path from 'node:path';
import fsSync from 'node:fs';
import { prisma } from '../lib/prisma';
import { verifyAccessToken, verifyPhotoAccessToken } from '../lib/auth';

export const photosRouter = Router();

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

function toThumbPath(relativePath: string): string {
  const ext = path.extname(relativePath);
  return `${relativePath.slice(0, -ext.length)}_thumb.jpg`;
}

photosRouter.get('/:id', async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  // <Image> tags can't set an Authorization header, so this route also
  // accepts a short-lived, photo-scoped token via `?token=`. A long-lived
  // bearer access token also works (e.g. for direct API use), but only for
  // the photo's own owner.
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

  let authorized = queryToken !== null && verifyPhotoAccessToken(photo.id, queryToken);
  if (!authorized && bearer) {
    try {
      const payload = verifyAccessToken(bearer);
      authorized = payload.sub === photo.userId;
    } catch {
      authorized = false;
    }
  }
  // 404 rather than 403 so an unauthorized request can't be used to confirm
  // that a given photo ID exists.
  if (!authorized) return res.status(404).json({ error: 'Photo not found' });

  const wantsThumb = req.query.size === 'thumb';
  const thumbRelativePath = toThumbPath(photo.filePath);
  const useThumb = wantsThumb && fsSync.existsSync(path.join(PHOTO_STORAGE_PATH, thumbRelativePath));
  const relativePath = useThumb ? thumbRelativePath : photo.filePath;
  const absolutePath = path.join(PHOTO_STORAGE_PATH, relativePath);
  if (!fsSync.existsSync(absolutePath)) {
    return res.status(404).json({ error: 'Photo file missing on disk' });
  }

  res.setHeader('Content-Type', useThumb ? 'image/jpeg' : photo.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  fsSync.createReadStream(absolutePath).pipe(res);
});
