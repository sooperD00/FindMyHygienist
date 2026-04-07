/**
 * Sprint 13 tests — search API wrappers.
 *
 * Verifies that apiSearchProviders builds the correct URLSearchParams
 * from different input combinations, that apiFeaturedProviders hits
 * the right endpoint, and that apiGetProviderTypes returns the
 * expected shape.
 *
 * These test the URL construction logic, not the backend — fetch is
 * mocked. The backend search endpoint is smoke-tested via Swagger.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  apiSearchProviders,
  apiFeaturedProviders,
  apiGetProviderTypes,
} from "../api/client";

// ── Mock fetch globally ──────────────────────────────────────────

const mockResponse = (data: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 400,
  json: () => Promise.resolve(data),
});

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── apiSearchProviders ───────────────────────────────────────────

describe("apiSearchProviders", () => {
  it("builds URLSearchParams with zip code", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: [], count: 0, page: 1, per_page: 20, total_count: 0, search_location: null }) as Response
    );

    await apiSearchProviders({ zipCode: "97123", radiusMiles: 10 });

    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("zipCode=97123");
    expect(url).toContain("radiusMiles=10");
    expect(url).not.toContain("latitude");
    expect(url).not.toContain("address");
  });

  it("builds URLSearchParams with lat/lng", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: [], count: 0, page: 1, per_page: 20, total_count: 0, search_location: null }) as Response
    );

    await apiSearchProviders({ latitude: 45.52, longitude: -122.68 });

    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("latitude=45.52");
    expect(url).toContain("longitude=-122.68");
  });

  it("builds URLSearchParams with address and filters", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: [], count: 0, page: 1, per_page: 20, total_count: 0, search_location: null }) as Response
    );

    await apiSearchProviders({
      address: "Portland, OR",
      providerType: "DENTAL_HYGIENIST",
      radiusMiles: 25,
      page: 2,
    });

    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("address=Portland%2C+OR"); // URLSearchParams encodes commas as %2C and spaces as +
    expect(url).toContain("providerType=DENTAL_HYGIENIST");
    expect(url).toContain("radiusMiles=25");
    expect(url).toContain("page=2");
  });

  it("omits undefined params from URL", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: [], count: 0, page: 1, per_page: 20, total_count: 0, search_location: null }) as Response
    );

    await apiSearchProviders({ zipCode: "97005" });

    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("zipCode=97005");
    // These should NOT appear since they weren't passed
    expect(url).not.toContain("radiusMiles");
    expect(url).not.toContain("providerType");
    expect(url).not.toContain("page");
  });
});

// ── apiFeaturedProviders ─────────────────────────────────────────

describe("apiFeaturedProviders", () => {
  it("hits /providers/featured with no params", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse({ results: [], count: 0, page: 1, per_page: 20, total_count: 0, search_location: "Oregon" }) as Response
    );

    const res = await apiFeaturedProviders();

    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("/providers/featured");
    expect(res.search_location).toBe("Oregon");
  });
});

// ── apiGetProviderTypes ──────────────────────────────────────────

describe("apiGetProviderTypes", () => {
  it("hits /providers/types and returns array", async () => {
    const mockTypes = [
      { code: "DENTAL_HYGIENIST", label: "Dental Hygienist" },
      { code: "DENTIST", label: "Dentist" },
    ];
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockResponse(mockTypes) as Response
    );

    const result = await apiGetProviderTypes();

    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("/providers/types");
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("DENTAL_HYGIENIST");
  });
});
