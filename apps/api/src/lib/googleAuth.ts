import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { decideGoogleAccountLink } from '@pokelids/shared';
import { prisma } from './prisma';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Hardcoded, never accepted from the client at request time (the task's own
// "リダイレクトURIのホワイトリスト" requirement) — this is the one and only
// redirect_uri this server will ever use for the code exchange, and it must
// exactly match the Authorized redirect URI registered for GOOGLE_CLIENT_ID
// in the Google Cloud Console project. A client-supplied redirect_uri would
// let an attacker redirect the exchanged identity to an arbitrary endpoint.
const GOOGLE_REDIRECT_URI = 'https://pokelids-collect.jp/auth/google/callback';

export class GoogleAuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// A fresh OAuth2Client per call rather than a module-level singleton. Unlike
// `resend` in email.ts (deliberately cached, since that SDK pools HTTP
// connections worth reusing), the benefit here is negligible — the
// constructor just stores the three strings passed to it — while a
// singleton captured at import time would permanently freeze in whatever
// GOOGLE_CLIENT_ID/SECRET happened to be set (or unset) at process start,
// which matters here specifically because those vars may not be configured
// yet at first deploy (see .env.example) and shouldn't require a restart to
// pick up once they are.
function client(): OAuth2Client {
  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

// Exchanges an authorization `code` for Google's tokens, then verifies the
// returned ID token's signature (against Google's published JWKS, fetched
// and cached internally by google-auth-library), issuer, audience, and
// expiry. `nonce` is the one standard OIDC check google-auth-library does
// NOT perform on your behalf (it isn't given an expected value to compare
// against) — verified here manually against whatever the caller captured
// at the start of this same sign-in attempt (see routes/auth.ts), which is
// what actually makes this useless as a replay of a *different*, earlier
// ID token even if one somehow leaked.
export async function verifyGoogleAuthorizationCode(
  code: string,
  expectedNonce: string,
): Promise<VerifiedGoogleIdentity> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new GoogleAuthError(503, 'Google sign-in is not configured');
  }

  const oauth2Client = client();

  let idToken: string | null | undefined;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    idToken = tokens.id_token;
  } catch {
    // Wrong/expired/already-used code, a redirect_uri mismatch, Google being
    // unreachable — all indistinguishable from here, and none of them are
    // this server's own bug, so this collapses to one generic client error.
    throw new GoogleAuthError(400, 'Invalid or expired authorization code');
  }
  if (!idToken) {
    throw new GoogleAuthError(400, 'Google did not return an ID token');
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await oauth2Client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleAuthError(400, 'Invalid ID token');
  }
  if (!payload || !payload.email || !payload.sub) {
    throw new GoogleAuthError(400, 'ID token is missing required claims');
  }
  if (payload.nonce !== expectedNonce) {
    throw new GoogleAuthError(400, 'Nonce mismatch');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name ?? null,
  };
}

export interface GoogleSignInResult {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: Date | null;
  // True only for a brand-new account created with an unverified Google
  // email — routes/auth.ts uses this to decide whether to also kick off the
  // normal 5-3 verification-email flow, the same as a plain /register would.
  needsEmailVerification: boolean;
}

// The part of this flow that's pure DB decision-making, deliberately
// separated from verifyGoogleAuthorizationCode above (Google-network-bound)
// so it can be exercised directly — against a real database, with a
// hand-built VerifiedGoogleIdentity — without needing a live Google account
// or network access. That's how this function's create/link/reject
// behavior was actually verified for this task (see git history / PR
// description); this repo has no DB-backed vitest suite (see
// apps/api/src/lib/auth.test.ts's own note on why), so this split is what
// made that verification possible at all.
export async function resolveGoogleUser(identity: VerifiedGoogleIdentity): Promise<GoogleSignInResult> {
  const bySub = await prisma.user.findUnique({ where: { googleId: identity.sub } });
  if (bySub) {
    return {
      id: bySub.id,
      email: bySub.email,
      displayName: bySub.displayName,
      emailVerifiedAt: bySub.emailVerifiedAt,
      needsEmailVerification: false,
    };
  }

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  const decision = decideGoogleAccountLink({
    googleEmailVerified: identity.emailVerified,
    existingUser: byEmail ? { emailVerifiedAt: byEmail.emailVerifiedAt?.toISOString() ?? null } : null,
  });

  if (decision === 'reject') {
    throw new GoogleAuthError(
      409,
      'このメールアドレスは既に登録されています。メールとパスワードでログインしてください。',
    );
  }

  if (decision === 'link') {
    // byEmail is guaranteed non-null here — decideGoogleAccountLink only
    // returns 'link' when existingUser was passed as non-null.
    const linked = await prisma.user.update({
      where: { id: byEmail!.id },
      data: { googleId: identity.sub },
    });
    return {
      id: linked.id,
      email: linked.email,
      displayName: linked.displayName,
      emailVerifiedAt: linked.emailVerifiedAt,
      needsEmailVerification: false,
    };
  }

  // 'create'. displayName always needs *some* value (User.displayName is
  // required) — Google's `name` claim isn't guaranteed present (see
  // TokenPayload's own doc comment in google-auth-library), so this falls
  // back to the email's local part, same spirit as any other placeholder
  // display name a user could freely rename later.
  const displayName = identity.name ?? identity.email.split('@')[0];
  const emailVerifiedAt = identity.emailVerified ? new Date() : null;
  const created = await prisma.user.create({
    data: {
      email: identity.email,
      googleId: identity.sub,
      passwordHash: null,
      displayName,
      emailVerifiedAt,
    },
  });
  return {
    id: created.id,
    email: created.email,
    displayName: created.displayName,
    emailVerifiedAt: created.emailVerifiedAt,
    needsEmailVerification: emailVerifiedAt === null,
  };
}
