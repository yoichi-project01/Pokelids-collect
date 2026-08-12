import { Platform } from 'react-native';

// Web-only for now (5-4) — this whole module is the "start the redirect,
// stash state/nonce, read them back on return" plumbing that a browser's
// full-page navigation needs. A future native path would replace this
// module with expo-auth-session, which handles the equivalent
// browser/deep-link dance itself on iOS/Android; the server side
// (POST /api/auth/google/exchange, apps/api's googleAuth.ts) already only
// ever takes {code, nonce} and knows nothing about how they were obtained,
// so it needs no changes to serve that native path later.
const GOOGLE_AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
// Must exactly match apps/api's own hardcoded GOOGLE_REDIRECT_URI
// (src/lib/googleAuth.ts) — Google itself also enforces this exact string
// match against whatever's registered as an Authorized redirect URI in
// Cloud Console for this client ID, so a mismatch here fails loudly at
// Google's consent screen rather than silently.
const REDIRECT_URI = 'https://pokelids-collect.jp/auth/google/callback';

const STATE_KEY = 'pokelids_google_oauth_state';
const NONCE_KEY = 'pokelids_google_oauth_nonce';

// Gates whether the "Googleでログイン" button renders at all (see
// GoogleSignInButton) — false on native (not implemented yet) and false
// whenever GOOGLE_CLIENT_ID hasn't been configured for this deployment
// (baked in at build time as EXPO_PUBLIC_GOOGLE_CLIENT_ID — see the
// Dockerfile), so an unconfigured deployment shows no button at all rather
// than one that 503s when tapped.
export function isGoogleSignInAvailable(): boolean {
  return Platform.OS === 'web' && Boolean(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID);
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Starts the redirect to Google's consent screen — call from the sign-in
// button's onPress. `state`/`nonce` are stashed in sessionStorage, not
// anywhere shared across tabs or persisted beyond this tab's lifetime —
// that's what actually makes the check in consumeGoogleCallback below a
// real CSRF defense: an attacker who starts their own real Google flow can
// obtain a validly-signed state of their own, but they can't make it match
// what's sitting in a DIFFERENT (the victim's) tab's sessionStorage, so a
// trick link built from the attacker's own flow can't complete here.
export function startGoogleSignIn(): void {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return; // isGoogleSignInAvailable() should already have hidden the button.

  const state = randomToken();
  const nonce = randomToken();
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    // Lets the user pick a different Google account than whichever they're
    // already silently signed into — this app has no way to guess which one
    // they mean, and guessing wrong here (silently signing in as the wrong
    // account) is more disruptive than one extra tap on Google's own account
    // chooser.
    prompt: 'select_account',
  });
  window.location.href = `${GOOGLE_AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export interface GoogleCallbackResult {
  code: string;
  nonce: string;
}

// Validates the `code`/`state` query params Google redirected back with
// (as parsed by expo-router's useLocalSearchParams — see
// app/auth/google/callback.tsx) against what startGoogleSignIn stashed.
// Both stored values are cleared unconditionally (not just on success) — a
// state/nonce pair is single-shot by design, meant to authenticate exactly
// one round trip, so there's nothing to gain by leaving a stale pair around
// after a failed attempt. Returns null if this doesn't look like a
// legitimate continuation of a flow this same tab actually started
// (missing/mismatched state, or no flow was ever started here at all — e.g.
// someone opened the callback URL directly).
export function consumeGoogleCallback(params: {
  code: string | undefined;
  state: string | undefined;
}): GoogleCallbackResult | null {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(NONCE_KEY);

  if (!params.code || !nonce || !expectedState || params.state !== expectedState) return null;
  return { code: params.code, nonce };
}
