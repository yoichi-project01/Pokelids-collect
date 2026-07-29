import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDto } from '@pokelids/shared';
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, setTokens } from './api';
import { confirmAsync } from './confirm';
import { getGuestCollections, syncGuestCollectionsToAccount } from './guestStorage';
import { getStoredTokens, removeStoredTokens, setStoredTokens } from './tokenStorage';

const STORAGE_KEY = 'pokelids_auth_tokens';

interface AuthContextValue {
  user: UserDto | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  async function login(email: string, password: string) {
    const result = await apiLogin(email, password);
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    await setStoredTokens(
      STORAGE_KEY,
      JSON.stringify({ accessToken: result.accessToken, refreshToken: result.refreshToken }),
    );
    setUser(result.user);
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
      await syncGuestCollectionsToAccount();
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
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
