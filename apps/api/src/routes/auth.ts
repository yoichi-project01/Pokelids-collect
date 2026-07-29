import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

authRouter.post('/register', async (req, res) => {
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

authRouter.post('/login', async (req, res) => {
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

  const accessToken = signAccessToken({ sub: stored.user.id, email: stored.user.email });
  res.json({ accessToken });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, displayName: user.displayName });
});
