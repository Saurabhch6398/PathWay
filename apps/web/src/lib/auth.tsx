import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, LoginInput, RegisterInput, UserDto } from '@pathway/shared';
import { api, refreshSession, setAccessToken } from './api';

interface AuthContextValue {
  user: UserDto | null;
  /** `loading` until the first attempt to restore a session has finished. */
  status: 'loading' | 'ready';
  login: (input: LoginInput) => Promise<UserDto>;
  register: (input: RegisterInput) => Promise<UserDto>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  // Restore the session from the refresh cookie on page load.
  useEffect(() => {
    refreshSession().then((session) => {
      setUser(session?.user ?? null);
      setStatus('ready');
    });
  }, []);

  const startSession = useCallback((session: AuthResponse) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    return session.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login: async (input) =>
        startSession(
          await api<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
        ),
      register: async (input) =>
        startSession(
          await api<AuthResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
        ),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user, status, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
