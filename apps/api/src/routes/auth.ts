import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { z } from 'zod';
import { sendPasswordResetEmail, sendEmailVerificationEmail } from '../lib/email';
import { removeFileBestEffort } from '../lib/fileCleanup';
import { GoogleAuthError, resolveGoogleUser, verifyGoogleAuthorizationCode } from '../lib/googleAuth';
import { prisma } from '../lib/prisma';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generatePasswordResetToken,
  hashPasswordResetToken,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from '../lib/auth';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import type { Request } from 'express';

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

// Shared by register (fire-and-forget, see call site below) and
// POST /verify-email/request (awaited, since sending IS the point of that
// request) — mirrors sendPasswordResetEmail's own call sites in only
// catching the *send*, not the token creation: a DB failure here is a real
// problem worth surfacing as a 500 from /verify-email/request, same as
// password-reset/request's own prisma.passwordResetToken.create is
// unguarded.
async function issueAndSendVerificationEmail(user: { id: string; email: string }): Promise<void> {
  const { token, hash, expiresAt } = generateEmailVerificationToken();
  await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash, expiresAt } });
  const verifyUrl = `${SITE_URL}/verify-email?token=${token}`;
  await sendEmailVerificationEmail(user.email, verifyUrl).catch((err) => {
    console.error('Failed to send email verification email', err);
  });
}

// The accessToken + refreshToken issuance dance is identical across
// /register, /login, and /google/exchange below (5-4 intentionally reuses
// this rather than inventing an SSO-specific session mechanism — see this
// task's own design note) — factored out once both to avoid drifting
// between three copies and so 52451d8's client-side automatic-refresh logic
// really does apply uniformly, regardless of how the session started.
async function issueSessionTokens(
  user: { id: string; email: string },
  req: Request,
): Promise<{ accessToken: string; refreshToken: string }> {
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
  return { accessToken, refreshToken };
}

function serializeUser(user: {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

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

  const { accessToken, refreshToken } = await issueSessionTokens(user, req);

  // Not awaited: sending the verification email is supplementary to
  // registration succeeding, not part of its contract — someone recording
  // their first find on a trip shouldn't wait on an email provider round
  // trip before the app is usable (see this task's own design note on why
  // being unverified never blocks anything). Errors are swallowed here too
  // (on top of issueAndSendVerificationEmail's own internal send-failure
  // catch) so even a DB hiccup while creating the token can't surface as a
  // failed registration.
  void issueAndSendVerificationEmail(user).catch((err) => {
    console.error('Failed to issue email verification token on register', err);
  });

  res.status(201).json({ accessToken, refreshToken, user: serializeUser(user) });
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
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  // A Google-only account (5-4) has no passwordHash to compare against at
  // all — a distinct, more helpful message here (rather than folding this
  // into the generic wrong-password 401 below) since the login form's own
  // password field can never be the right answer for this account no
  // matter what's typed, and the client (login.tsx) keys off this exact
  // string to show the tailored guidance rather than "wrong password."
  if (!user.passwordHash) {
    return res.status(401).json({ error: 'This account uses Google sign-in' });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const { accessToken, refreshToken } = await issueSessionTokens(user, req);

  res.json({ accessToken, refreshToken, user: serializeUser(user) });
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

const verifyEmailRequestSchema = z.object({
  email: z.string().email(),
});

// credentialRateLimit (not a dedicated tighter limiter, unlike
// passwordResetRateLimit above) — confirming an address is lower-stakes
// than a password-reset flood, and this endpoint already shares its abuse
// surface (an email address, resend-able) with /register, so sharing that
// same budget is enough to blunt a mail-bombing attempt without another
// limiter instance to keep in sync.
authRouter.post('/verify-email/request', credentialRateLimit, async (req, res) => {
  const parsed = verifyEmailRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Skips issuing a token at all once already verified — not required for
  // the enumeration defense below (the response is identical either way),
  // just avoids minting a pointless token and sending a mail nobody needs.
  if (user && !user.emailVerifiedAt) {
    await issueAndSendVerificationEmail(user);
  }

  // Same shape regardless of whether the account exists (or is already
  // verified) — same enumeration defense as password-reset/request above.
  res.json({ ok: true });
});

const verifyEmailConfirmSchema = z.object({
  token: z.string().min(1),
});

authRouter.post('/verify-email/confirm', async (req, res) => {
  const parsed = verifyEmailConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const hash = hashEmailVerificationToken(parsed.data.token);
  const stored = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!stored) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }

  // Guards against a stale-but-still-valid token from an earlier
  // /verify-email/request re-confirming an already-verified user (e.g. they
  // requested twice, clicked the older email second) — usedAt alone only
  // stops *this* token being replayed, not a *different*, still-live token
  // for the same account. email is unique on User, so this can only ever be
  // "this same account, already verified", never a genuine collision with
  // someone else's account.
  if (stored.user.emailVerifiedAt) {
    return res.status(400).json({ error: 'Email already verified' });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: stored.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
  ]);

  res.status(204).end();
});

const googleExchangeSchema = z.object({
  code: z.string().min(1),
  // Same value the client generated and embedded in the initial authorize
  // request (see apps/mobile's googleAuth.ts) — round-tripped back here so
  // verifyGoogleAuthorizationCode can confirm it matches the `nonce` claim
  // actually baked into the ID token Google returns, not just trust that
  // the caller is telling the truth about which flow this code belongs to.
  nonce: z.string().min(1),
});

// credentialRateLimit (shared with /login and /register, not a dedicated
// instance): the authorization `code` itself isn't a brute-forceable secret
// (single-use, short-lived, issued by Google — nothing to guess), but this
// still calls out to Google's token endpoint and touches the DB per
// request, and sharing the budget with the other credential-adjacent
// endpoints below is enough defense-in-depth against casual hammering
// without adding a fourth limiter instance to keep in sync.
authRouter.post('/google/exchange', credentialRateLimit, async (req, res) => {
  const parsed = googleExchangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  let identity;
  try {
    identity = await verifyGoogleAuthorizationCode(parsed.data.code, parsed.data.nonce);
  } catch (err) {
    if (err instanceof GoogleAuthError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  let result;
  try {
    result = await resolveGoogleUser(identity);
  } catch (err) {
    if (err instanceof GoogleAuthError) return res.status(err.status).json({ error: err.message });
    throw err;
  }

  // Mirrors /register's own fire-and-forget verification email for exactly
  // the same reason (see issueAndSendVerificationEmail's callers) — this
  // only actually fires for a brand-new account whose Google email came
  // back unverified (see resolveGoogleUser's needsEmailVerification); a
  // linked or already-verified account never reaches here at all.
  if (result.needsEmailVerification) {
    void issueAndSendVerificationEmail(result).catch((err) => {
      console.error('Failed to issue email verification token on Google sign-in', err);
    });
  }

  const { accessToken, refreshToken } = await issueSessionTokens(result, req);
  res.json({ accessToken, refreshToken, user: serializeUser(result) });
});

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(serializeUser(user));
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
