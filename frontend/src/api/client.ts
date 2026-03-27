/**
 * API client — typed fetch wrappers with automatic CSRF token handling.
 *
 * CSRF flow (ADR-006, synchronizer token pattern):
 *   1. Backend sets csrf_token cookie (JS-readable) on login/register
 *   2. getCsrfToken() reads it from document.cookie
 *   3. apiFetch() attaches it as X-CSRF-Token header on POST/PUT/DELETE
 *   4. Backend validates header against the session row in Postgres
 *
 * The csrf_token cookie is a *delivery mechanism* — the source of truth
 * is the session row, not the cookie. See dependencies.py.
 */

import type { LoginRequest, MeResponse, RegisterRequest } from "../types/auth";

const API_BASE = "/api";

// ── CSRF helper ──────────────────────────────────────────────────

/**
 * Parse the csrf_token cookie from document.cookie.
 *
 * Exported for testing — the cookie string is semicolon-delimited
 * key=value pairs with optional whitespace. Returns empty string if
 * the cookie isn't set (e.g., before login).
 */
export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

// ── Core fetch wrapper ───────────────────────────────────────────

const CSRF_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

/**
 * Thin wrapper around fetch that:
 *   - Prefixes the API base URL
 *   - Sets Content-Type: application/json (when there's a body)
 *   - Attaches X-CSRF-Token on state-changing methods
 *   - Throws on non-OK responses with the detail message from FastAPI
 *
 * Returns the raw Response so callers can .json() with their own type.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (CSRF_METHODS.has(method)) {
    headers.set("X-CSRF-Token", getCsrfToken());
  }

  // raw response
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: "same-origin", // send cookies (session_id + csrf_token)
  });

  if (!res.ok) {
    // FastAPI error responses have { detail: "..." }
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      // response wasn't JSON — use the status text
    }
    const err = new Error(detail);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  return res;
}

// ── Auth endpoints ───────────────────────────────────────────────

export async function apiRegister(data: RegisterRequest): Promise<MeResponse> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiLogin(data: LoginRequest): Promise<MeResponse> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function apiGetMe(): Promise<MeResponse> {
  const res = await apiFetch("/auth/me");
  return res.json();
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);  // raw fetch (not apiFetch) bc no auth, CSRF, structured error parsing needed etc
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
