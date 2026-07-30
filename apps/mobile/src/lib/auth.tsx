import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDto } from '@pokelids/shared';
import {
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  setTokens,
  setTokensChangedListener,
} from './api';
import { alertAsync, confirmAsync } from './confirm';
import { getGuestCollections, syncGuestCollectionsToAccount } from './guestStorage';
import { getStoredTokens, removeStoredTokens, setStoredTokens } from './tokenStorage';

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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

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

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await setStoredTokens(
      STORAGE_KEY,
      JSON.stringify({ accessToken: result.accessToken, refreshToken: result.refreshToken }),
    );
    setUser(result.user);
    setSessionExpired(false);
    await maybeSyncGuestCollections();
  }

  async function register(email: string, password: string, displayName: string) {
    const result = await apiRegister(email, password, displayName);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await setStoredTokens(
      STORAGE_KEY,
      JSON.stringify({ accessToken: result.accessToken, refreshToken: result.refreshToken }),
    );
    setUser(result.user);
    setSessionExpired(false);
    await maybeSyncGuestCollections();
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
      const synced = await syncGuestCollectionsToAccount();
      if (synced < guestItems.length) {
        alertAsync(
          '一部を保存できませんでした',
          `${synced}/${guestItems.length}件を保存しました。残りは次回ログイン時に再試行します。`,
        );
      }
    } catch {
      // Login/register already succeeded at this point; a sync failure here
      // must not surface as a login error. The records stay in local
      // storage and will be offered again on the next login.
    }
  }

  async function logout() {
    await apiLogout();
    setTokens(null);
    await removeStoredTokens(STORAGE_KEY);
    setUser(null);
    setSessionExpired(false);
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
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
