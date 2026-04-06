/**
 * Search — the landing page IS the search page.
 *
 * Route: / (landing) and /providers/or/:city (pre-filled search)
 *
 * Two states, one component:
 *   1. Landing (no search submitted): headline, search bar, featured
 *      example providers as showcase. The directory looks alive.
 *   2. Active search (user searched): real results with filters,
 *      distance, pagination. Example providers excluded automatically
 *      by the backend.
 *
 * The featured providers come from GET /api/providers/featured
 * (lightweight, no location input needed). Real search hits
 * GET /api/providers with location + filter params.
 *
 * Layout modeled on PsychologyToday's therapist search page.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  apiFeaturedProviders,
  apiSearchProviders,
  apiGetProviderTypes,
} from "../api/client";
import ProviderCard from "../components/ProviderCard";
import type {
  ProviderSearchResult,
  ProviderTypeOption,
  SearchResponse,
  SearchParams,
} from "../types/provider";

/* ── Radius options ── */
const RADIUS_OPTIONS = [
  { value: 5, label: "5 miles" },
  { value: 10, label: "10 miles" },
  { value: 25, label: "25 miles" },
  { value: 0, label: "Show all" },
];

function Search() {
  const { city } = useParams<{ city?: string }>();

  // ── Form state ──
  const [locationInput, setLocationInput] = useState(city ?? "");
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [providerType, setProviderType] = useState("");
  const [providerTypes, setProviderTypes] = useState<ProviderTypeOption[]>([]);

  // ── Results state ──
  const [featured, setFeatured] = useState<ProviderSearchResult[]>([]);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lon: number } | null>(null); // stash coords

  // ── Load provider types for filter dropdown ──
  useEffect(() => {
    apiGetProviderTypes()
      .then(setProviderTypes)
      .catch(() => {
        /* non-critical — filter just won't appear */
      });
  }, []);

  // ── Load featured providers for landing state ──
  useEffect(() => {
    let cancelled = false;  // React cleanup pattern
    apiFeaturedProviders()
      .then((res) => {
        if (!cancelled) setFeatured(res.results);
      })
      .catch(() => {
        /* landing still works without featured providers */
      });
    return () => { cancelled = true; };
  }, []);

  // ── If routed with :city param, search immediately ──
  useEffect(() => {
    if (city) { // no `let cancelled` pattern needed here bc user-initiated
      setLocationInput(city);
      doSearch(city);
    }
    // Intentionally omitting doSearch — we only want to re-trigger search
    // on URL city param changes, not on filter state changes.
    // doSearch closes over current radiusMiles/providerType, which
    // is the desired behavior: use whatever filters are set:
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  // ── Search handlers ──
  async function executeSearch(params: SearchParams) {
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await apiSearchProviders(params);
      setSearchResult(res);
      return res;  // return results becasue e.g. pagination might use it, even if geolocation doesn't
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
      setSearchResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // build params
  async function doSearch(location?: string) {
    const query = (location ?? locationInput).trim();

    // Reuse stashed geolocation coords if user hasn't changed the input
    // !location guard is so the city-param path (doSearch(city)) doesn't accidentally hit the geo branch
    const useGeo = geoCoords && locationInput === "Current location" && !location;

    if (!useGeo && !query) return;

    const isZip = /^\d{5}(-\d{4})?$/.test(query);

    await executeSearch(
      useGeo
        ? {
            latitude: geoCoords.lat,
            longitude: geoCoords.lon,
            ...(radiusMiles > 0 ? { radiusMiles } : {}),
            ...(providerType ? { providerType } : {}),
          }
        : {
            ...(isZip ? { zipCode: query } : { address: `${query}, OR` }),
            ...(radiusMiles > 0 ? { radiusMiles } : {}),
            ...(providerType ? { providerType } : {}),
          }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doSearch();
  }

  function handleGeolocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });

        await executeSearch({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...(radiusMiles > 0 ? { radiusMiles } : {}),
          ...(providerType ? { providerType } : {}),
        });

        setLocationInput("Current location");
      },
      () => {
        setError("Could not get your location. Try entering a zip code.");
        setLoading(false);
      }
    );
  }

  // ── Which results to show? ──
  const showLanding = !hasSearched;
  const results = showLanding ? featured : (searchResult?.results ?? []);

  return (
    <div className="search-page">
      {/* ── Hero / headline ── */}
      <div className="search-hero">
        <h1 className="search-title">Oregon's Dental Hygienists</h1>
        <p className="search-subtitle">
          Find care by approach, preferences, and style
        </p>
      </div>

      {/* ── Search bar ── */}
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-bar-inputs">
          <input
            type="text"
            className="search-input"
            placeholder="Zip code or city"
            value={locationInput}
            onChange={(e) => {
              setLocationInput(e.target.value);
              setGeoCoords(null);  // clear existing input for geo coords if user types something
            }}
            aria-label="Location — zip code or city name"
          />
          <button
            type="button"
            className="search-geo-btn"
            onClick={handleGeolocation}
            title="Use my location"
            aria-label="Use my current location"
          >
            📍
          </button>
          <select
            className="search-radius"
            value={radiusMiles}
            onChange={(e) => setRadiusMiles(Number(e.target.value))}
            aria-label="Search radius"
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {providerTypes.length > 0 && (
            <select
              className="search-filter-type"
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
              aria-label="Provider type"
            >
              <option value="">All provider types</option>
              {providerTypes.map((pt) => (
                <option key={pt.code} value={pt.code}>
                  {pt.label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-primary search-submit">
            Search
          </button>
        </div>
      </form>

      {/* ── Error ── */}
      {error && <p className="search-error">{error}</p>}

      {/* ── Loading ── */}
      {loading && <p className="search-loading">Searching…</p>}

      {/* ── Results section ── */}
      {!loading && (
        <div className="search-results-section">
          {/* Result count header */}
          {hasSearched && searchResult && (
            <p className="search-result-count">
              {searchResult.total_count === 0
                ? "No providers found — try a different location or broader radius."
                : `${searchResult.total_count} provider${searchResult.total_count !== 1 ? "s" : ""} found`}
              {searchResult.search_location &&
                searchResult.total_count > 0 &&
                ` near ${searchResult.search_location}`}
            </p>
          )}

          {/* Landing state label */}
          {showLanding && featured.length > 0 && (
            <p className="search-featured-label">
              Meet some of Oregon's providers
            </p>
          )}

          {/* Provider cards */}
          <div className="search-results">
            {results.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                showDistance={hasSearched}
              />
            ))}
          </div>
        
          {/* TODO: Pagination controls — backend returns page/total_count/per_page.
            Wire up prev/next buttons that call doSearch with { page: N }.
            Not conference-critical (seed data < 20 results). */}
        
        </div>
      )}

      {/* ── "List with us" CTA ── */}
      <div className="search-cta">
        <p className="search-cta-text">
          Are you a dental hygienist or oral health provider in Oregon?
        </p>
        <Link to="/join" className="btn btn-primary search-cta-btn">
          List With Us
        </Link>
      </div>
    </div>
  );
}

export default Search;
