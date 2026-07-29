import 'dotenv/config';
import 'express-async-errors';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { authRouter } from './routes/auth';
import { pokeLidsRouter } from './routes/pokeLids';
import { collectionsRouter } from './routes/collections';
import { photosRouter } from './routes/photos';
import { progressRouter } from './routes/progress';
import { prisma } from './lib/prisma';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const SITE_URL = 'https://pokelids-collect.jp';

// The app sits behind exactly one reverse proxy (Cloudflare Tunnel via
// cloudflared, bound to 127.0.0.1:3000). Without this, express-rate-limit
// sees every request as coming from that single proxy connection and shares
// its limit across ALL users instead of per-client.
app.set('trust proxy', 1);

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

app.use('/api/auth', authRouter);
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

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

const STATIC_SITEMAP_PATHS = ['/', '/prefectures', '/map', '/login', '/register', '/privacy', '/terms'];

app.get('/sitemap.xml', async (_req, res) => {
  const lids = await prisma.pokeLid.findMany({ select: { id: true, updatedAt: true } });
  const urlEntries = [
    ...STATIC_SITEMAP_PATHS.map((p) => `<url><loc>${SITE_URL}${p}</loc></url>`),
    ...lids.map(
      (l) =>
        `<url><loc>${SITE_URL}/poke-lids/${l.id}</loc><lastmod>${l.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`,
    ),
  ];
  res
    .type('application/xml')
    .set('Cache-Control', 'public, max-age=3600')
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries.join('')}</urlset>`,
    );
});

const webBuildDir = path.join(__dirname, '..', 'public');
// `extensions: ['html']` is required for the extensionless static routes
// (e.g. /login -> login.html) — without it, express.static only matches
// exact filenames, so those requests were silently falling through to the
// SPA fallback below and serving the wrong page's HTML (with the wrong
// per-page <title>/meta baked in from static rendering).
app.use(express.static(webBuildDir, { extensions: ['html'] }));
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
