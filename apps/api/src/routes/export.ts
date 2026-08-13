import { Router } from 'express';
import rateLimit from 'express-rate-limit';
// Pinned to archiver 7.x (package.json), not the latest 8.x: archiver 8
// rewrote the package as ESM-only and dropped the classic
// `archiver('zip', opts)` factory function entirely in favor of
// `new ZipArchive(opts)` — incompatible with this app's CommonJS build
// (apps/api/tsconfig.json's `module: commonjs`). 7.x is still the last
// version with the factory API this file uses.
import archiver from 'archiver';
import fsSync from 'node:fs';
import path from 'node:path';
import { PREFECTURES, buildExportCsv, type ExportCollectionRecord, type PhotoMedal } from '@pokelids/shared';
import { prisma } from '../lib/prisma';
import { signExportAccessToken, verifyExportAccessToken } from '../lib/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const exportRouter = Router();

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';

// Generation (GET /download below) reads every one of a user's original
// photos off disk and streams them into a zip — cheap per request compared
// to, say, a photo upload, but not something that should be triggerable in
// a tight loop. Rate-limited here, on the mint step, rather than on
// /download itself: /download's actual cost is bounded by how many *fresh*
// tokens get minted (this route), not by how many times an already-minted
// token gets used — same division of responsibility as
// collections.ts's uploadRateLimit guarding POST / rather than GET
// /photos/:id. A minted token's own 10-minute TTL (see lib/auth.ts) is what
// keeps a handful of legitimate re-opens (a stuck download, a double-click)
// cheap and unlimited without needing a second limiter to reconcile with
// this one.
const exportRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: Number(process.env.EXPORT_RATE_LIMIT_PER_DAY ?? '5'),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthedRequest) => req.userId!,
});

// POST /api/export: requires a real Bearer session (unlike the download
// route below) and just mints a short-lived signed URL — the actual
// generation work happens on GET /download once the client navigates there.
exportRouter.post('/', requireAuth, exportRateLimit, (req: AuthedRequest, res) => {
  const token = signExportAccessToken(req.userId!);
  res.json({ url: `/api/export/download?token=${token}` });
});

// Characters that are safe in a zip entry name across the platforms this
// app's users actually unzip on (Windows/macOS/mobile file browsers).
// PokeLid.name is scraped external data (see etl/scrape.ts) built from a
// municipality name and pokemon names — not attacker-controlled in the
// usual sense, but never validated as filesystem-safe either, so this
// applies the same "don't trust it" discipline as the upload MIME
// whitelist rather than assuming it's fine because the source is official.
function sanitizeForZipEntry(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'unknown';
}

function buildReadme(params: { displayName: string; generatedAtIso: string; recordCount: number }): string {
  const generatedAtJst = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(params.generatedAtIso));
  return `ポケふたコレクト — データエクスポート

ユーザー: ${params.displayName}
生成日時: ${generatedAtJst} (JST)
収集記録数: ${params.recordCount}件

このZIPには以下が含まれています:

- collections.json / collections.csv
    収集記録の一覧（ポケふた名・都道府県・市区町村・訪問日・メダル・メモ・距離）
- photos/
    アップロードした写真の原本（収集記録ごとにフォルダ分け）

https://pokelids-collect.jp
`;
}

// GET /api/export/download: deliberately NOT behind requireAuth. This is
// opened via direct navigation (Linking.openURL on native, a plain link on
// web) to let the platform's own download/share UI take over, the same
// reason photos.ts's photo delivery accepts a query token instead of an
// Authorization header. The signed token IS the authorization — it already
// encodes which user it's for (see verifyExportAccessToken) — so there's no
// separate ownership check to perform once it verifies.
exportRouter.get('/download', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const userId = token ? verifyExportAccessToken(token) : null;
  // 404 rather than 401 — same reasoning as photos.ts: an unauthorized
  // request shouldn't even confirm that this endpoint exists in a
  // meaningfully different state for a missing vs. invalid token.
  if (!userId) return res.status(404).json({ error: 'Not found' });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  if (!user) return res.status(404).json({ error: 'Not found' });

  const collections = await prisma.collection.findMany({
    where: { userId },
    include: { pokeLid: true, photos: { orderBy: { createdAt: 'asc' } } },
    orderBy: { visitedAt: 'asc' },
  });

  const prefectureNameById = new Map(PREFECTURES.map((p) => [p.id, p.nameJa]));
  const generatedAt = new Date();

  const records: ExportCollectionRecord[] = collections.map((collection) => {
    // The primary photo represents the collection everywhere else in the
    // app (PhotoDto.isPrimary) — reused here rather than inventing a new
    // notion of which photo's medal/distance speaks for the visit. Falls
    // back to the oldest photo if, for some reason, none is flagged
    // primary (shouldn't happen given the partial unique index, but this
    // avoids the export silently dropping medal/distance over an
    // assumption this route has no way to enforce).
    const primaryPhoto = collection.photos.find((p) => p.isPrimary) ?? collection.photos[0] ?? null;
    return {
      pokeLidId: collection.pokeLidId,
      pokeLidName: collection.pokeLid.name,
      prefectureNameJa: prefectureNameById.get(collection.pokeLid.prefectureId) ?? '',
      municipality: collection.pokeLid.municipality,
      visitedAt: collection.visitedAt.toISOString(),
      notes: collection.notes,
      medal: (primaryPhoto?.medal as PhotoMedal | undefined) ?? null,
      distanceMeters: primaryPhoto?.exifDistanceMeters ?? null,
      photoCount: collection.photos.length,
    };
  });

  const dateStamp = generatedAt.toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="pokelids-collect-export-${dateStamp}.zip"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const archive = archiver('zip', { zlib: { level: 6 } });
  // By the time either of these can fire, headers are typically already
  // flushed (archive.pipe(res) below writes the first entry immediately) —
  // there's no well-formed error response left to send, so this only logs.
  // An unhandled 'error' listener would otherwise crash the process
  // (Node's default EventEmitter behavior for an emitted 'error' with no
  // listener), which is the one failure mode that must be prevented here.
  archive.on('warning', (err) => console.error('Export archive warning', { userId, error: err.message }));
  archive.on('error', (err) => console.error('Export archive error', { userId, error: err.message }));
  archive.pipe(res);

  archive.append(JSON.stringify(records, null, 2), { name: 'collections.json' });
  archive.append(buildExportCsv(records), { name: 'collections.csv' });
  archive.append(
    buildReadme({
      displayName: user.displayName,
      generatedAtIso: generatedAt.toISOString(),
      recordCount: records.length,
    }),
    { name: 'README.txt' },
  );

  for (const collection of collections) {
    const folderName = sanitizeForZipEntry(collection.pokeLid.name);
    for (const photo of collection.photos) {
      const absolutePath = path.join(PHOTO_STORAGE_PATH, photo.filePath);
      // Best-effort, same tolerance as photos.ts's own missing-file case
      // (fileCleanup.ts's ORPHAN_FILE log covers the write side already) —
      // one missing file must not abort the whole export.
      if (!fsSync.existsSync(absolutePath)) continue;
      const ext = path.extname(photo.filePath);
      archive.file(absolutePath, { name: `photos/${folderName}/${photo.id}${ext}` });
    }
  }

  try {
    await archive.finalize();
  } catch (err) {
    console.error('Failed to finalize export archive', { userId, error: (err as Error).message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate export' });
    } else {
      res.end();
    }
  }
});
