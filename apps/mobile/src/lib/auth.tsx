import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthTokensDto, PhotoMedal, UserDto } from '@pokelids/shared';
import { SyncCompleteModal } from '../components/SyncCompleteModal';
import { UploadProgressBanner } from '../components/UploadProgressBanner';
import {
  exchangeGoogleCode,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  setTokens,
  setTokensChangedListener,
} from './api';
import { confirmAsync } from './confirm';
import { getGuestCollections, syncGuestCollectionsToAccount, type GuestSyncResult } from './guestStorage';
import { getStoredTokens, removeStoredTokens, setStoredTokens } from './tokenStorage';
import { showToast } from './toast';

function totalMedalCount(medalCounts: Record<PhotoMedal, number>): number {
  return medalCounts.GOLD + medalCounts.SILVER + medalCounts.NONE;
}

const STORAGE_KEY = 'pokelids_auth_tokens';

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  // True after the user was logged out involuntarily, because the refresh
  // token itself was rejected (30 days elapsed, or revoked by a logout
  // elsewhere) rather than by them tapping "logout". Lets the login screen
  // explain why they're suddenly looking at it instead of leaving them to
  // wonder.
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  // 5-4: takes the {code, nonce} already produced by
  // googleAuth.ts's consumeGoogleCallback and does the same
  // session-establishment + guest-sync dance as login/register — deliberately
  // not a separate SSO session mechanism (see this feature's own design
  // note: 52451d8's automatic-refresh logic must apply the same way
  // regardless of how the session started).
  loginWithGoogleCode: (code: string, nonce: string) => Promise<void>;
  logout: () => Promise<void>;
  // Re-fetches /api/auth/me and updates the context's `user` in place —
  // used by verify-email.tsx after a successful confirm, so a logged-in
  // tab's settings screen stops showing the "未確認" notice immediately
  // instead of only after the next full auth restore (app relaunch/reload).
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Local to this provider, not exposed via AuthContextValue: unlike
  // showToast (toast.ts), which needs to be callable from many unrelated
  // call sites across the app and so uses a module-level listener, sync
  // status only ever originates from maybeSyncGuestCollections below — plain
  // component state is enough, and keeps the public auth context free of UI
  // concerns no other screen needs to read.
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [syncCelebration, setSyncCelebration] = useState<GuestSyncResult | null>(null);

  useEffect(() => {
    // Registered before the initial fetchMe() call below so that if the
    // stored access token is already expired, the transparent refresh-retry
    // in api.ts's request() has somewhere to persist the rotated tokens (or
    // clear them, if the refresh token itself is no longer valid).
    setTokensChangedListener((tokens) => {
      if (tokens) {
        void setStoredTokens(STORAGE_KEY, JSON.stringify(tokens));
      } else {
        void removeStoredTokens(STORAGE_KEY);
        setUser(null);
        setSessionExpired(true);
      }
    });

    (async () => {
      try {
        const raw = await getStoredTokens(STORAGE_KEY);
        if (raw) {
          setTokens(JSON.parse(raw));
          const me = await fetchMe();
          setUser(me);
        }
      } catch {
        await removeStoredTokens(STORAGE_KEY);
        setTokens(null);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => setTokensChangedListener(null);
  }, []);

  // Shared tail of login/register/loginWithGoogleCode below: persist the
  // freshly-issued session, adopt the returned user, and offer to sync
  // whatever the guest recorded before this login. Factored out once these
  // three call sites all needed to do it identically, rather than because
  // any one of them is more complex on its own.
  async function establishSession(result: AuthTokensDto & { user: UserDto }) {
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await setStoredTokens(
      STORAGE_KEY,
      JSON.stringify({ accessToken: result.accessToken, refreshToken: result.refreshToken }),
    );
    setUser(result.user);
    setSessionExpired(false);
    await maybeSyncGuestCollections();
  }

  async function login(email: string, password: string) {
    await establishSession(await apiLogin(email, password));
  }

  async function register(email: string, password: string, displayName: string) {
    await establishSession(await apiRegister(email, password, displayName));
  }

  async function loginWithGoogleCode(code: string, nonce: string) {
    await establishSession(await exchangeGoogleCode(code, nonce));
  }

  async function maybeSyncGuestCollections() {
    const guestItems = await getGuestCollections();
    if (guestItems.length === 0) return;

    const confirmed = await confirmAsync(
      'ローカルの収集記録を保存',
      `ログイン前に記録した${guestItems.length}件の収集記録があります。アカウントに保存しますか？`,
    );
    if (!confirmed) return;

    try {
      setSyncProgress(0);
      const result = await syncGuestCollectionsToAccount((fraction) => setSyncProgress(fraction));
      const medalTotal = totalMedalCount(result.medalCounts);

      // Partial-failure / limit-hit messaging stays on this same 4-5-style
      // toast regardless of whether any photos synced — it's reporting sync
      // mechanics ("what didn't make it, and why"), which is a different
      // concern from SyncCompleteModal below (which only ever talks about
      // what *did* sync, so it can stay unambiguously celebratory — see that
      // component's own doc comment for why the two aren't merged).
      if (result.recordsSyncedCount < result.recordsTotalCount) {
        const reasonSuffix = result.stoppedByLimit && result.limitMessage ? `（${result.limitMessage}）` : '';
        showToast(
          '一部を保存できませんでした',
          `${result.recordsSyncedCount}/${result.recordsTotalCount}件を保存しました。残りは次回ログイン時に再試行します。${reasonSuffix}`,
        );
      } else if (medalTotal === 0) {
        // No photos were part of this sync (or none produced a medal) —
        // nothing new to celebrate, so the plain toast is the whole story,
        // same as this looked before phase 2 added photos at all.
        showToast(
          '保存しました',
          `${result.recordsSyncedCount}件の記録をアカウントに保存しました。`,
          'success',
        );
      }

      // Shown whenever at least one photo actually got a medal this sync,
      // even alongside the partial-failure toast above — celebrating what
      // succeeded and reporting what didn't aren't mutually exclusive here.
      if (medalTotal > 0) {
        setSyncCelebration(result);
      }
    } catch {
      // Login/register already succeeded at this point; a sync failure here
      // must not surface as a login error. The records stay in local
      // storage and will be offered again on the next login.
    } finally {
      setSyncProgress(null);
    }
  }

  async function logout() {
    await apiLogout();
    setTokens(null);
    await removeStoredTokens(STORAGE_KEY);
    setUser(null);
    setSessionExpired(false);
  }

  async function refreshUser() {
    // A no-op while logged out (nothing to refresh) rather than throwing —
    // verify-email.tsx calls this unconditionally after a successful
    // confirm, whether or not the confirming tab happens to be logged in.
    if (!user) return;
    try {
      setUser(await fetchMe());
    } catch {
      // Same reasoning as the initial restore effect above: a transient
      // failure here shouldn't be surfaced as anything more than "the
      // notice didn't update yet" — the next natural fetchMe() (app
      // relaunch, token refresh) will pick up the real state.
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        sessionExpired,
        clearSessionExpired: () => setSessionExpired(false),
        login,
        register,
        loginWithGoogleCode,
        logout,
        refreshUser,
      }}
    >
      {children}
      {syncProgress !== null && <UploadProgressBanner progress={syncProgress} label="同期中" />}
      {syncCelebration && (
        <SyncCompleteModal
          visible
          recordsSyncedCount={syncCelebration.recordsSyncedCount}
          medalCounts={syncCelebration.medalCounts}
          onClose={() => setSyncCelebration(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
