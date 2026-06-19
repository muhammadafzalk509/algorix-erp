import type { Tier } from './permissions';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  permissionTier: Tier;
}

const ACCESS = 'erp_access';
const REFRESH = 'erp_refresh';
const USER = 'erp_user';

export const tokenStore = {
  get access() {
    return typeof window !== 'undefined' ? localStorage.getItem(ACCESS) : null;
  },
  get refresh() {
    return typeof window !== 'undefined' ? localStorage.getItem(REFRESH) : null;
  },
  get user(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },
  set(access: string, refresh: string, user: AuthUser) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
    localStorage.setItem(USER, JSON.stringify(user));
  },
  setTokens(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  setUser(user: AuthUser) {
    localStorage.setItem(USER, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem(USER);
  },
};

async function refreshAccess(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  const res = await fetch(`${BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  tokenStore.setTokens(data.access_token, data.refresh_token);
  return true;
}

async function raw(path: string, init: RequestInit, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = tokenStore.access;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && tokenStore.refresh) {
    const ok = await refreshAccess();
    if (ok) return raw(path, init, false);
    tokenStore.clear();
  }
  return res;
}

async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  const res = await raw(path, { ...init, headers });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const msg =
      (data as { message?: string | string[] })?.message ||
      `Request failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => json<T>(p),
  post: <T>(p: string, body?: unknown) =>
    json<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(p: string, body?: unknown) =>
    json<T>(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown) =>
    json<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(p: string) => json<T>(p, { method: 'DELETE' }),
  // multipart upload (documents)
  upload: <T>(p: string, form: FormData) =>
    raw(p, { method: 'POST', body: form }).then(async (res) => {
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error((d as { message?: string })?.message || 'Upload failed');
      return d as T;
    }),
  // download a binary response (e.g. PDF) and trigger a browser save
  download: async (p: string, filename: string) => {
    const res = await raw(p, { method: 'GET' });
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      throw new Error((d as { message?: string })?.message || 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export async function loginRequest(email: string, password: string, department?: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, department }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Login failed');
  return data as { access_token: string; refresh_token: string; user: AuthUser };
}

export async function googleLoginRequest(idToken: string, department?: string) {
  const res = await fetch(`${BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, department }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Google sign-in failed');
  return data as { access_token: string; refresh_token: string; user: AuthUser };
}

export { BASE as API_BASE };
