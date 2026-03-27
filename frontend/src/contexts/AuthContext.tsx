/**
 * Auth context — single source of truth for "who is logged in?"
 *
 * On mount, calls GET /api/auth/me to restore the session from the
 * HTTP-only cookie. If the cookie is missing or expired, user stays
 * null and isLoading flips to false — no error, just "not logged in."
 *
 * login(), register(), and logout() call the API client, update local
 * state, and return (or throw). Navigation is the caller's job — the
 * Join and Login pages decide where to redirect after success.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { apiGetMe, apiLogin, apiLogout, apiRegister } from "../api/client";
import type {
  LoginRequest,
  MeResponse,
  RegisterRequest,
  UserResponse,
} from "../types/auth";

// ── Context shape ────────────────────────────────────────────────

interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<MeResponse>;
  register: (data: RegisterRequest) => Promise<MeResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Hook ─────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount — the session_id cookie is HTTP-only,
  // so the only way to check if we're logged in is to ask the server.
  useEffect(() => {
    let cancelled = false;
    apiGetMe()
      .then((me) => {
        if (!cancelled) {
          setUser(me.user);
        }
      })
      .catch(() => {
        // 401 = not logged in, which is fine. Any other error
        // (network, 500) also means we can't confirm auth — treat
        // as logged out rather than showing a broken state.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (data: LoginRequest): Promise<MeResponse> => {
    const me = await apiLogin(data);
    setUser(me.user);
    return me;
  }, []);

  const register = useCallback(
    async (data: RegisterRequest): Promise<MeResponse> => {
      const me = await apiRegister(data);
      setUser(me.user);
      return me;
    },
    []
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiLogout();
    } catch {
      // Session might already be expired — that's fine, clear local
      // state regardless so the UI updates.
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
