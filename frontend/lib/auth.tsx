'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  loginRequest,
  googleLoginRequest,
  tokenStore,
  type AuthUser,
} from './api';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, department?: string) => Promise<void>;
  loginWithGoogle: (idToken: string, department?: string) => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

// Landing page per role: developers → their work queue, VP Engineering → the
// VP portal, everyone else → the shared dashboard.
function landingFor(tier: string): string {
  if (tier === 'TIER_5') return '/task-logs';
  if (tier === 'TIER_2') return '/vpe';
  if (tier === 'TIER_3' || tier === 'TIER_4') return '/department';
  return '/dashboard';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setUser(tokenStore.user);
    setLoading(false);
  }, []);

  async function login(email: string, password: string, department?: string) {
    const data = await loginRequest(email, password, department);
    tokenStore.set(data.access_token, data.refresh_token, data.user);
    setUser(data.user);
    router.push(landingFor(data.user.permissionTier));
  }

  async function loginWithGoogle(idToken: string, department?: string) {
    const data = await googleLoginRequest(idToken, department);
    tokenStore.set(data.access_token, data.refresh_token, data.user);
    setUser(data.user);
    router.push(landingFor(data.user.permissionTier));
  }

  // Merge fresh profile fields (name/email) into the session so the sidebar,
  // header and other views update without a re-login.
  function updateUser(patch: Partial<AuthUser>) {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      tokenStore.setUser(next);
      return next;
    });
  }

  function logout() {
    api.post('/auth/logout').catch(() => {});
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }

  return (
    <Ctx.Provider value={{ user, loading, login, loginWithGoogle, updateUser, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
