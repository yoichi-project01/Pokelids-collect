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
import { exportRouter } from './routes/export';
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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        // The map screen embeds an iframe (srcDoc) that, having no CSP of
        // its own, inherits this one — it needs to load OpenStreetMap tiles,
        // which aren't same-origin. `blob:` is needed separately: web's
        // expo-image-picker returns a `blob:` URI for a picked/captured
        // photo, and PhotoPreviewModal's <Image source={{ uri }} /> renders
        // it directly (no upload/network round-trip involved) — without
        // this the preview silently fails to load.
        // https://pagead2.googlesyndication.com is AdSense's script host
        // (MONETIZATION.md) — script tag only right now (no ad slots, see
        // apps/mobile's +html.tsx), but the loader script itself already
        // needs img-src to fetch a 1x1 tracking pixel / config resources on
        // load, before any ad is ever requested. ep1.adtrafficquality.google
        // is the same invalid-traffic-detection "sodar" system as
        // connect-src below, here fetching a pixel via <img> rather than
        // fetch(). Both confirmed via the live browser console
        // (2026-08-13), not guessed from documentation.
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://*.tile.openstreetmap.org',
          'https://pagead2.googlesyndication.com',
          'https://ep1.adtrafficquality.google',
        ],
        // Expo Router's static export injects a tiny fixed inline bootstrap
        // script (`globalThis.__EXPO_ROUTER_HYDRATE__=true;`) on every page
        // to signal client-side hydration; this is its exact hash, not
        // something this app's code writes. If it ever fails after an Expo
        // upgrade, check the browser console for the new sha256- value.
        // ep2.adtrafficquality.google serves sodar2.js, part of Google's
        // invalid-traffic-detection system AdSense's loader pulls in even
        // with zero ad slots present — confirmed via the live browser
        // console (2026-08-13), same as everything else on this list; see
        // connect-src's comment below for why this is a *different*
        // numbered subdomain from the one connect-src needs.
        'script-src': [
          "'self'",
          "'sha256-67fhrP0+BkBqmgGGXTtgiVO/9EQs3QruYNU/7fnRkI8='",
          'https://pagead2.googlesyndication.com',
          'https://ep2.adtrafficquality.google',
        ],
        // No override existed before this (helmet's default is
        // connect-src 'self', which the app never needed to widen until
        // now — every API call is same-origin). AdSense's loader script
        // reports back to its own domain even with no ad slots present,
        // and separately polls ep1.adtrafficquality.google (Google's
        // invalid-traffic-detection "sodar" getconfig endpoint) — both
        // confirmed by watching the actual browser console against the
        // live site (2026-08-13), not guessed from documentation. Note
        // ep1 here vs. ep2 in script-src above: Google's adtrafficquality
        // system spreads its own script/connect traffic across several
        // numbered subdomains, apparently not the same one for both —
        // a wildcard *.adtrafficquality.google was deliberately not used
        // regardless, per this file's "no broad wildcards" rule; if a
        // *third* numbered subdomain shows up in the console later, add
        // that specific one too rather than switching to a wildcard.
        'connect-src': [
          "'self'",
          'https://pagead2.googlesyndication.com',
          'https://ep1.adtrafficquality.google',
        ],
        // No override existed before this (helmet's default-src 'self' was
        // covering same-origin framing implicitly, hence 'self' here too).
        // AdSense's loader opens several hidden bootstrap/verification
        // iframes even with zero ad slots present and Auto ads off —
        // googleads.g.doubleclick.net (ad request correlator),
        // ep2.adtrafficquality.google (the same invalid-traffic-detection
        // system as script-src/connect-src above, here via an iframe
        // rather than a script/fetch), and www.google.com (a Google-hosted
        // verification frame). All three confirmed via the live browser
        // console (2026-08-13), not assumed from docs.
        'frame-src': [
          "'self'",
          'https://googleads.g.doubleclick.net',
          'https://ep2.adtrafficquality.google',
          'https://www.google.com',
        ],
      },
    },
  }),
);
app.use(express.json());

// `SELECT 1` only proves Postgres is reachable, not that its schema matches
// what Prisma Client expects — a migration that wasn't actually applied
// (see 2026-08-08's missing `photos.original_filename` column) returns 200
// here while every real query 500s. `findFirst()` with no `select` forces
// Prisma to query every mapped column, so a missing/renamed column throws
// here too. A narrow `select: { id: true }` would NOT catch this — it only
// asks Postgres for the id column, so it stays silent about drift anywhere
// else in the row (verified against the actual missing-column scenario).
app.get('/health', async (_req, res) => {
  try {
    await Promise.all([prisma.photo.findFirst(), prisma.collection.findFirst()]);
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
app.use('/api/export', exportRouter);

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

// /login and /register are excluded on purpose — nothing to index, and every
// crawled URL spends crawl budget that's better spent on content pages.
const STATIC_SITEMAP_PATHS = ['/', '/map', '/privacy', '/terms'];

app.get('/sitemap.xml', async (_req, res) => {
  const [lids, prefectures] = await Promise.all([
    prisma.pokeLid.findMany({ select: { id: true, updatedAt: true } }),
    prisma.prefecture.findMany({ select: { id: true } }),
  ]);
  const urlEntries = [
    ...STATIC_SITEMAP_PATHS.map((p) => `<url><loc>${SITE_URL}${p}</loc></url>`),
    // The prefecture pages ("ポケふた 兵庫県") are the mid-tier pages that
    // match search intent best — more generic than an individual poke lid,
    // more specific than the home page.
    ...prefectures.map((p) => `<url><loc>${SITE_URL}/prefectures/${p.id}</loc></url>`),
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
