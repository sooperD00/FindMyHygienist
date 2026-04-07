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
 * 
 * TODO: res.json() returns `any` — return types are trusted, not
 * validated. Add Zod schemas for each response type and .parse()
 * before returning. See tech debt list.
 */

import type { LoginRequest, MeResponse, RegisterRequest } from "../types/auth";
import type {
  Credential,
  LocationCreate,
  LocationUpdate,
  OwnLocation,
  OwnProfile,
  PhotoResponse,
  ProfileUpdate,
  PublicProfile,
  SearchParams,
  SearchResponse,
  ProviderTypeOption,
} from "../types/provider";

// dev, local vs main, production
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

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

  // FormData must be left alone — the browser generates the multipart
  // boundary string automatically, and setting Content-Type manually
  // stomps it. (Tests: client-profile.test.ts, first two cases.)
  const needsJsonContentType =
    options.body &&
    !headers.has("Content-Type") &&
    !(options.body instanceof FormData);

  if (needsJsonContentType) {
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
    credentials: "include", // send cookies (session_id + csrf_token), allow cross-site (protected by token)
    // credentials: "same-origin", // subdomains do not count as same domain
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

// ── Credentials (public) ──────────────────────────────────────────

export async function apiGetCredentials(): Promise<Credential[]> {
  const res = await apiFetch("/credentials");
  return res.json();
}

// ── Public provider profile ──────────────────────────────────────

export async function apiGetPublicProfile(
  slug: string,
  id: string
): Promise<PublicProfile> {
  const res = await apiFetch(`/providers/${slug}/${id}`);
  return res.json();
}

// ── Search (public) ──────────────────────────────────────────────

/**
 * Search providers by location + filters.
 *
 * Different shape from the path-based wrappers above: takes an object
 * of query params, builds URLSearchParams, returns a paginated
 * SearchResponse with distance metadata.
 * 
 * Does not accept `featured` as a param - this is for real searches only
 * (separate endpoing for `featured` only is intentional design)
 */

// TODO: Extract a toSearchParams() utility that strips null/undefined
// and builds URLSearchParams in a loop. Every new filter currently
// adds two lines here; the utility makes it one key-value entry.

export async function apiSearchProviders(
  params: SearchParams
): Promise<SearchResponse> {
  const qs = new URLSearchParams();

  if (params.latitude != null) qs.set("latitude", String(params.latitude));
  if (params.longitude != null) qs.set("longitude", String(params.longitude));
  if (params.zipCode) qs.set("zipCode", params.zipCode);
  if (params.address) qs.set("address", params.address);
  if (params.radiusMiles != null)
    qs.set("radiusMiles", String(params.radiusMiles));
  if (params.providerType) qs.set("providerType", params.providerType);
  if (params.credential) qs.set("credential", params.credential);
  if (params.acceptingNewPatients != null)
    qs.set("acceptingNewPatients", String(params.acceptingNewPatients));
  if (params.insurance) qs.set("insurance", params.insurance);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.perPage != null) qs.set("perPage", String(params.perPage));

  const res = await apiFetch(`/providers?${qs.toString()}`);
  return res.json();
}

/**
 * Featured providers for the landing page — no location input needed.
 */
export async function apiFeaturedProviders(): Promise<SearchResponse> {
  const res = await apiFetch("/providers/featured");
  return res.json();
}

/**
 * Provider type enum values for filter dropdowns.
 */
export async function apiGetProviderTypes(): Promise<ProviderTypeOption[]> {
  const res = await apiFetch("/providers/types");
  return res.json();
}

// ── Profile (authenticated) ───────────────────────────────────────

export async function apiGetOwnProfile(): Promise<OwnProfile> {
  const res = await apiFetch("/me/profile");
  return res.json();
}

export async function apiUpdateProfile(data: ProfileUpdate): Promise<OwnProfile> {
  const res = await apiFetch("/me/profile", {  // Profile is a (heterogeneous) record — fixed, named fields of different types -> dict/kvps -> PATCH
    method: "PATCH", // "Here are the three fields I changed, leave everything else alone." BE uses `exclude_unset`
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiUpdateCredentials(
  codes: string[]
): Promise<Credential[]> {  // Credentials are a (homogeneous) collection — a variable number of items that are all the same shape -> array -> PUT
  const res = await apiFetch("/me/credentials", { // ["RDH", "EPDH"] 
    method: "PUT",  // "Here is the complete list. Replace whatever's there with this."
    body: JSON.stringify({ codes }),
  });
  return res.json();
}

// ── Photo (authenticated, multipart) ──────────────────────────────

export async function apiUploadPhoto(file: File): Promise<PhotoResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await apiFetch("/me/photo", {
    method: "POST",
    body: formData,
    // Content-Type intentionally omitted — browser sets it with
    // multipart boundary. The FormData check in apiFetch() handles this.
  });
  return res.json();
}

export async function apiDeletePhoto(): Promise<PhotoResponse> {
  const res = await apiFetch("/me/photo", { method: "DELETE" });
  return res.json();  
  // backend returns { photo_url: null }
  // returns the new state (null URL) so the UI can update
}

// ── Locations (authenticated) ─────────────────────────────────────

export async function apiGetLocations(): Promise<OwnLocation[]> {
  const res = await apiFetch("/me/locations");
  return res.json();
}

export async function apiCreateLocation(
  data: LocationCreate
): Promise<OwnLocation> {
  const res = await apiFetch("/me/locations", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiUpdateLocation(
  id: string,
  data: LocationUpdate
): Promise<OwnLocation> {
  const res = await apiFetch(`/me/locations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDeleteLocation(id: string): Promise<void> {
  await apiFetch(`/me/locations/${id}`, { method: "DELETE" });
  // no return — backend returns 204 No Content
  // returns nothing because the UI just removes the card
}
