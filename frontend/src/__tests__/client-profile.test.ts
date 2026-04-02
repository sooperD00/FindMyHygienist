/**
 * Sprint 6 tests — API client extensions.
 *
 * Tests the new typed wrappers and the FormData Content-Type fix.
 * These are the highest-value tests for this sprint because the
 * client wrappers are the foundation everything else sits on.
 *
 * Pattern matches client.test.ts from Sprint 3: mock fetch globally,
 * verify paths, methods, headers, and body shapes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Shared setup ──────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({}),
    status: 200,
  });
  vi.stubGlobal("fetch", fetchSpy);

  // Set a known CSRF token
  Object.defineProperty(document, "cookie", {
    get: () => "csrf_token=test-csrf-token",
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  const desc = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie"
  );
  if (desc) {
    Object.defineProperty(Document.prototype, "cookie", desc);
  }
});

// ── FormData Content-Type fix ─────────────────────────────────────

describe("apiFetch FormData handling", () => {
  it("does NOT set Content-Type when body is FormData", async () => {
    const { apiFetch } = await import("../api/client");
    const formData = new FormData();
    formData.append("file", new Blob(["test"]), "test.jpg");

    await apiFetch("/me/photo", { method: "POST", body: formData });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options.headers as Headers;
    // Browser must set Content-Type with multipart boundary — we must NOT override it
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("still sets Content-Type: application/json for string body", async () => {
    const { apiFetch } = await import("../api/client");
    await apiFetch("/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ bio: "test" }),
    });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});

// ── Profile endpoints ─────────────────────────────────────────────

describe("profile API wrappers", () => {
  it("apiGetOwnProfile sends GET /api/me/profile", async () => {
    const { apiGetOwnProfile } = await import("../api/client");
    await apiGetOwnProfile();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/profile");
    expect(options.method).toBe("GET");
  });

  it("apiUpdateProfile sends PATCH with body", async () => {
    const { apiUpdateProfile } = await import("../api/client");
    await apiUpdateProfile({ bio: "Hello world" });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/profile");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ bio: "Hello world" });
  });
});

// ── Credential endpoints ──────────────────────────────────────────

describe("credential API wrappers", () => {
  it("apiGetCredentials sends GET /api/credentials (public)", async () => {
    const { apiGetCredentials } = await import("../api/client");
    await apiGetCredentials();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/credentials");
    expect(options.method).toBe("GET");
  });

  it("apiUpdateCredentials sends PUT with codes array", async () => {
    const { apiUpdateCredentials } = await import("../api/client");
    await apiUpdateCredentials(["RDH", "BSDH"]);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/credentials");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ codes: ["RDH", "BSDH"] });
  });
});

// ── Photo endpoints ───────────────────────────────────────────────

describe("photo API wrappers", () => {
  it("apiUploadPhoto sends POST with FormData", async () => {
    const { apiUploadPhoto } = await import("../api/client");
    const file = new File(["pixels"], "photo.jpg", { type: "image/jpeg" });
    await apiUploadPhoto(file);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/photo");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    // Verify the file field name matches what FastAPI expects
    expect((options.body as FormData).get("file")).toBeTruthy();
  });

  it("apiDeletePhoto sends DELETE /api/me/photo", async () => {
    const { apiDeletePhoto } = await import("../api/client");
    await apiDeletePhoto();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/photo");
    expect(options.method).toBe("DELETE");
  });
});

// ── Location endpoints ────────────────────────────────────────────

describe("location API wrappers", () => {
  it("apiGetLocations sends GET /api/me/locations", async () => {
    const { apiGetLocations } = await import("../api/client");
    await apiGetLocations();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/locations");
    expect(options.method).toBe("GET");
  });

  it("apiCreateLocation sends POST with body", async () => {
    const { apiCreateLocation } = await import("../api/client");
    await apiCreateLocation({
      label: "Based in",
      zip_code: "97123",
      state: "OR",
      is_public: false,
      is_primary: true,
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/locations");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.label).toBe("Based in");
    expect(body.is_public).toBe(false);
  });

  it("apiUpdateLocation sends PATCH to /api/me/locations/{id}", async () => {
    const { apiUpdateLocation } = await import("../api/client");
    await apiUpdateLocation("abc-123", { is_public: true });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/locations/abc-123");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ is_public: true });
  });

  it("apiDeleteLocation sends DELETE to /api/me/locations/{id}", async () => {
    const { apiDeleteLocation } = await import("../api/client");
    await apiDeleteLocation("abc-123");

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/me/locations/abc-123");
    expect(options.method).toBe("DELETE");
  });
});


// ── Error handling ────────────────────────────────────────────────

// Five tests, covers both gaps. The error tests hit both branches of apiFetch 
// catch (JSON detail vs. non-JSON fallback). The CSRF tests check POST and DELETE 
// as representatives of CSRF_METHODS, plus GET as the negative case — no need to 
// test all four methods since they all go through the same Set.has() check.

describe("apiFetch error handling", () => {
  it("throws with detail message and status on non-OK response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: "Validation failed" }),
    });

    const { apiFetch } = await import("../api/client");

    try {
      await apiFetch("/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ bio: "test" }),
      });
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("Validation failed");
      expect((err as Error & { status: number }).status).toBe(422);
    }
  });

  it("falls back to status code when response isn't JSON", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });

    const { apiFetch } = await import("../api/client");

    try {
      await apiFetch("/me/profile");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toBe("API error: 500");
    }
  });
});

// ── CSRF header ───────────────────────────────────────────────────

describe("CSRF token handling", () => {
  it("attaches X-CSRF-Token on POST", async () => {
    const { apiFetch } = await import("../api/client");
    await apiFetch("/me/photo", { method: "POST", body: new FormData() });

    const headers = fetchSpy.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
  });

  it("attaches X-CSRF-Token on DELETE", async () => {
    const { apiFetch } = await import("../api/client");
    await apiFetch("/me/locations/abc", { method: "DELETE" });

    const headers = fetchSpy.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
  });

  it("does NOT attach X-CSRF-Token on GET", async () => {
    const { apiFetch } = await import("../api/client");
    await apiFetch("/me/profile");

    const headers = fetchSpy.mock.calls[0][1].headers as Headers;
    expect(headers.has("X-CSRF-Token")).toBe(false);
  });
});