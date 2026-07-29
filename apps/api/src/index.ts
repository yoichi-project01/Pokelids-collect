import 'dotenv/config';
import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { authRouter } from './routes/auth';
import { pokeLidsRouter } from './routes/pokeLids';
import { collectionsRouter } from './routes/collections';
import { photosRouter } from './routes/photos';
import { progressRouter } from './routes/progress';
import { prisma } from './lib/prisma';

const app = express();
const port = Number(process.env.PORT ?? 3000);

// The web build and API are served from the same origin, so the only
// cross-origin caller in practice is the native mobile app (which doesn't
// send an Origin header at all). Restricting this closes off arbitrary
// third-party sites making credentialed requests against the API.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'https://pokelids-collect.jp' }));
app.use(helmet());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authRateLimit, authRouter);
app.use('/api/poke-lids', pokeLidsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/progress', progressRouter);

// Official poke-lid artwork downloaded by etl/scrape.ts (see downloadOfficialImage)
// instead of hotlinking local.pokemon.jp on every page view.
const officialImagesDir = path.join(process.env.PHOTO_STORAGE_PATH ?? '/data/photos', 'official');
app.use('/api/official-images', express.static(officialImagesDir, { maxAge: '30d', immutable: true }));

// Placed before the SPA fallback below so unknown API routes get a JSON 404
// instead of the web app's index.html.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const webBuildDir = path.join(__dirname, '..', 'public');
app.use(express.static(webBuildDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webBuildDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
