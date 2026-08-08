import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { z } from 'zod';
import { sendPasswordResetEmail } from '../lib/email';
import { removeFileBestEffort } from '../lib/fileCleanup';
import { prisma } from '../lib/prisma';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generatePasswordResetToken,
  hashPasswordResetToken,
} from '../lib/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

const PHOTO_STORAGE_PATH = process.env.PHOTO_STORAGE_PATH ?? '/data/photos';
// Matches the constant of the same name in index.ts (used for the
// sitemap) — the site only has the one production origin, so this is kept as
// a plain literal there too rather than introducing a shared config module.
const SITE_URL = 'https://pokelids-collect.jp';

// Only /register and /login are brute-forceable (a guessable password); /me
// and /refresh are called on every app launch / token expiry and shouldn't
// share this budget, and /refresh's secret (a random 384-bit token) isn't
// meaningfully brute-forceable via a request-rate limit anyway.
const credentialRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// A separate, tighter instance (rather than reusing credentialRateLimit) so
// a burst of login attempts from one IP can't also block that IP's own
// password-reset requests, and vice versa. Also guards against using this
// endpoint to mail-bomb an arbitrary address.
const passwordResetRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

authRouter.post('/register', credentialRateLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
  }
  const { email, password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
  });

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      deviceInfo: req.headers['user-agent']?.slice(0, 255),
    },
  });

  res.status(201).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', credentialRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt,
      deviceInfo: req.headers['user-agent']?.slice(0, 255),
    },
  });

  res.json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!stored) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Rotate: the old refresh token is single-use. If it's replayed after this
  // point (e.g. because it was stolen), it's already revoked and rejected.
  const { token: refreshToken, hash: newHash, expiresAt } = generateRefreshToken();
  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        tokenHash: newHash,
        expiresAt,
        deviceInfo: stored.deviceInfo,
      },
    }),
  ]);

  const accessToken = signAccessToken({ sub: stored.user.id, email: stored.user.email });
  res.json({ accessToken, refreshToken });
});

authRouter.post('/logout', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  res.status(204).end();
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/password-reset/request', passwordResetRateLimit, async (req, res) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const { token, hash, expiresAt } = generatePasswordResetToken();
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
    // A send failure shouldn't turn into a 500 that hints the account
    // exists; log it and still return the same response as the success
    // path below.
    await sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      console.error('Failed to send password reset email', err);
    });
  }

  // Always the same response whether or not the account exists — otherwise
  // this endpoint could be used to enumerate registered emails.
  res.json({ ok: true });
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post('/password-reset/confirm', async (req, res) => {
  const parsed = passwordResetConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const hash = hashPasswordResetToken(parsed.data.token);
  const stored = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!stored) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    // Whoever holds a stolen session shouldn't survive a password reset —
    // the same reasoning as refresh token rotation, just applied to every
    // session at once instead of a single token.
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, displayName: user.displayName });
});

authRouter.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  // File removal first, DB row second — the reverse of what this looked
  // like before. If fs.rm fails partway through (permissions, a busy file)
  // after the DB delete had already run, the response would 500 even
  // though the account really is gone, and there'd be no user row left to
  // account for the orphaned directory. Trying the (best-effort, logged)
  // file removal first means the DB delete — the operation that actually
  // defines "deleted" for the user — always runs last and unconditionally,
  // so the response accurately reflects it.
  await removeFileBestEffort(path.join(PHOTO_STORAGE_PATH, userId), { userId, recursive: true });
  // Cascades to refresh_tokens, collections, and photos at the DB level
  // (onDelete: Cascade in the schema); the photo files themselves aren't
  // tracked by Postgres, which is why they're removed separately above.
  await prisma.user.delete({ where: { id: userId } });
  res.status(204).end();
});
