/**
 * Sprint 3 tests — API client CSRF handling.
 *
 * getCsrfToken is the hinge of the entire CSRF protection chain:
 * if it parses wrong, every POST/PUT/DELETE gets a 403. These tests
 * exercise real cookie-string edge cases.
 *
 * apiFetch header tests verify that X-CSRF-Token is attached on
 * state-changing methods and absent on GETs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCsrfToken } from "../api/client";

// ── getCsrfToken ─────────────────────────────────────────────────

describe("getCsrfToken", () => {
  // Save and restore document.cookie between tests.
  // jsdom's cookie jar is cumulative, so we reset it manually.
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "cookie"
  );

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(Document.prototype, "cookie", originalDescriptor);
    }
  });

  function mockCookie(value: string) {
    Object.defineProperty(document, "cookie", {
      get: () => value,
      configurable: true,
    });
  }

  it("returns empty string when no cookies are set", () => {
    mockCookie("");
    expect(getCsrfToken()).toBe("");
  });

  it("parses csrf_token when it's the only cookie", () => {
    mockCookie("csrf_token=abc123");
    expect(getCsrfToken()).toBe("abc123");
  });

  it("parses csrf_token from multiple cookies", () => {
    mockCookie("session_id=xyz; csrf_token=my-token-value; other=stuff");
    expect(getCsrfToken()).toBe("my-token-value");
  });

  it("handles URL-encoded token values", () => {
    mockCookie("csrf_token=abc%3D%3D123");
    expect(getCsrfToken()).toBe("abc==123");
  });

  it("returns empty string when csrf_token cookie is missing", () => {
    mockCookie("session_id=xyz; other=stuff");
    expect(getCsrfToken()).toBe("");
  });

  it("handles csrf_token as the last cookie (no trailing semicolon)", () => {
    mockCookie("session_id=xyz; csrf_token=final-value");
    expect(getCsrfToken()).toBe("final-value");
  });

  it("doesn't match partial cookie names like my_csrf_token", () => {
    mockCookie("my_csrf_token=fake; csrf_token=real");
    expect(getCsrfToken()).toBe("real");
  });
});

// ── apiFetch header behavior ─────────────────────────────────────

describe("apiFetch CSRF header", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock fetch globally — we're testing header logic, not network.
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
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
    // Restore cookie descriptor
    const desc = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "cookie"
    );
    if (desc) {
      Object.defineProperty(Document.prototype, "cookie", desc);
    }
  });

  it("attaches X-CSRF-Token on POST requests", async () => {
    // Dynamic import to pick up the mocked fetch
    const { apiFetch } = await import("../api/client");
    await apiFetch("/auth/logout", { method: "POST" });

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBe("test-csrf-token");
  });

  it("does NOT attach X-CSRF-Token on GET requests", async () => {
    const { apiFetch } = await import("../api/client");
    await apiFetch("/auth/me");

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options.headers as Headers;
    expect(headers.get("X-CSRF-Token")).toBeNull();
  });
});
