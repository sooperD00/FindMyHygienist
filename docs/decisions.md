# Architecture Decision Records

## ADR-001: Monorepo with frontend/ and backend/

**Date:** 2026-03-19
**Status:** Accepted

**Context:** OHP has a React/TypeScript frontend and a FastAPI/Python backend. We could use separate repos or a monorepo.

**Decision:** Monorepo. `frontend/` and `backend/` at the root.

**Rationale:** Same pattern as ApplicationPipeline. One `git clone`, one PR for full-stack changes, shared CI config. The two halves deploy independently (different runtimes) but develop together. No package sharing between them that would justify a more complex monorepo tool (nx, turborepo).

---

## ADR-002: No field-level encryption for provider PII

**Date:** 2026-03-19
**Status:** Accepted

**Context:** Provider profiles contain PII (name, phone, email, address). Do we need to encrypt these fields in the database?

**Decision:** No field-level encryption. Standard Postgres encryption at rest (provided by Railway) is sufficient.

**Rationale:** This is a public directory. The entire purpose is for providers to publish their contact information and credentials. The data is intentionally public by design — it's displayed on the search page and profile page to anonymous visitors. Encrypting fields that are served unencrypted over a public API adds complexity with zero security benefit. The only sensitive credential is the password, which is bcrypt-hashed (standard auth library behavior). Login email (if different from public contact email) is access-controlled at the API layer, not encrypted at the field level. There is no medical/patient data anywhere in the system — no HIPAA applies.

---

## ADR-003: Approval flow with draft column for edit review

**Date:** 2026-03-19
**Status:** Accepted

**Context:** Provider profiles need admin approval before going live. When an already-approved provider edits their profile, those edits also need review.

**Decision:** `status` enum on the provider record for initial approval. `draft` JSON column for post-approval edits. Draft holds the proposed changes; live fields stay untouched until admin approves.

**Rationale:** This avoids a full versioning/history system. The draft column is nullable — null means "no pending edits." Admin queue is a single query: `WHERE status = 'PENDING' OR draft IS NOT NULL`. Conference mode (`AUTO_APPROVE=true`) bypasses the queue for initial signup but the edit-review flow still applies. Simple enough for one admin (Nicole) managing a manageable volume of Oregon providers.

**Alternatives considered:** Separate `provider_drafts` table with full history — overkill for MVP. Shadow copy of the whole profile row — doubles storage and query complexity for the same behavior.

---

## ADR-004: Static geocoding lookup for MVP

**Date:** 2026-03-19
**Status:** Accepted

**Context:** The search page converts a city name or zip code to lat/lng for Haversine distance queries.

**Decision:** Ship with a static lookup table of Oregon cities and zip codes mapped to their centroid coordinates. No external geocoding API for MVP.

**Rationale:** Oregon has ~400 incorporated cities and ~500 zip codes. A JSON file or small DB table is fast, free, requires no API key, and works offline. Accuracy is "centroid of the city/zip" which is good enough when the search radius is 10-25 miles. Upgrade to a geocoding API (Nominatim/Mapbox) later if users need street-level input or autocomplete.

---

## ADR-005: S3-compatible object storage for profile photos

**Date:** 2026-03-19
**Status:** Accepted

**Context:** Provider profile photos need to be stored somewhere accessible via URL.

**Decision:** S3-compatible object storage — either DigitalOcean Spaces ($5/month) or Cloudflare R2 (free tier). Decision deferred until deployment sprint. Both use the same `boto3` SDK calls.

**Rationale:** Photos don't belong in Postgres (binary blobs degrade query performance and complicate backups). S3-compatible storage is the industry standard: upload via SDK, store the URL in the database, serve directly from the CDN. Public-read ACL means no signed URL complexity. Either provider (DO Spaces, R2) works identically from the application code — only the endpoint URL changes in config.

---

## ADR-006: Auth approach

**Date:** 2026-03-19
**Status:** Proposed — finalize in Sprint 1

**Context:** Providers need to log in to create and edit their profiles. Nicole needs admin access.

**Decision:** TBD. Candidates:

1. **Session-based auth** (server-side sessions in Postgres or Redis, session cookie). Simpler mental model, no token refresh logic, works naturally with browser cookies.
2. **JWT** (access token + refresh token). Stateless, no server-side session store, but more moving parts (token refresh, secure storage in frontend).
3. **Third-party auth** (Auth0, Clerk, Supabase Auth). Least code, most features (magic links, OAuth, password reset), but adds a dependency and possible cost.

**Leaning toward:** Session-based or a lightweight third-party service. Will decide when the sprint starts and we see what the FastAPI ecosystem offers with minimal boilerplate.

<!-- Admin auth for Nicole: simplest version is a boolean `is_admin` column
     on the user record. No role system needed — there's one admin. -->

---

## ADR-007: TypeScript on the frontend

**Date:** 2026-03-19
**Status:** Accepted

**Context:** ApplicationPipeline's frontend used JavaScript/React. OHP is a chance to level up.

**Decision:** TypeScript for the frontend. React + TypeScript + Vite.

**Rationale:** Nicole wants to add TypeScript to her skillset. The API response types map naturally to TypeScript interfaces, which makes the frontend more self-documenting and catches bugs at compile time rather than runtime. Vite's TypeScript support is zero-config.

---

## ADR-008: Oregon-only scope, but don't hardcode it

**Date:** 2026-03-19
**Status:** Accepted

**Context:** OHP launches in Oregon. Could it expand to other states?

**Decision:** Ship Oregon-only. But keep `state` as a field on provider locations rather than hardcoding "OR" everywhere. URL structure uses `/providers/or/:city` (state in the path). Search defaults to Oregon but the data model doesn't prevent other states.

**Rationale:** Zero extra work to keep the door open. The static geocoding table (ADR-004) is Oregon-only for now, but adding another state's cities/zips is just adding rows.
