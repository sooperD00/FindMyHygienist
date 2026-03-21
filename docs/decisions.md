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

<!-- Admin auth for Nicole: User.role enum (PROVIDER, ADMIN) on the
     separate User table — see ADR-009. Expandable if we ever need
     facility managers, ODHA staff, etc. -->

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

---

## ADR-009: User table separates auth identity from provider profile

**Date:** 2026-03-20
**Status:** Accepted

**Context:** The original design put `email`, `password_hash`, and an implied `is_admin` flag on the Provider table. But Nicole (the admin) isn't a provider — she doesn't have a display_name, slug, bio, or provider_type. Storing her login credentials on a Provider record creates a phantom profile that has to be excluded from search results, and it conflates two concepts: "someone who can log in" and "someone listed in the directory."

**Decision:** Separate `User` table for auth identity. `User` has `email`, `password_hash`, `role` (enum: `PROVIDER`, `ADMIN`), `is_active`, and timestamps. `Provider` has a `user_id` FK (unique, one-to-one) pointing to `User`. Nicole's account is a User with `role=ADMIN` and no associated Provider. A dental hygienist's account is a User with `role=PROVIDER` linked to a Provider record.

**Rationale:** Clean separation of concerns. The admin doesn't pollute the directory. The role enum is expandable — if we ever need facility managers, ODHA staff, or other non-provider roles, it's a new enum value, not a schema change. Registration creates both records in one transaction, so providers don't experience the split. The `is_active` flag on User allows account deactivation without deleting data — orthogonal to `Provider.status` which controls directory visibility.

**Alternatives considered:** Boolean `is_admin` on Provider — quick but hacky, creates a phantom provider for the admin. Separate `Admin` table — overkill, only one admin, and doesn't generalize.

---

## ADR-010: Structured credential reference table with seed data

**Date:** 2026-03-20
**Status:** Accepted

**Context:** The original design stored credentials as a freeform JSON array (`["RDH", "BSDH"]`) on the Provider record. This can't power the "tappable credential chips" feature from Focus Group #1 (12/18/24): patients need to see plain-English explanations of what each credential means for them, not alphabet soup. The oral-health-providers project already built a credential reference system with 17 Oregon-specific entries, each with a code, full name, patient-facing description, and type (License, Degree, Permit, Specialty).

**Decision:** `Credential` reference table seeded from `credentials.json`. Fields: `code` (PK), `full_name`, `patient_description`, `credential_type` (enum: LICENSE, DEGREE, PERMIT, SPECIALTY). Many-to-many join table `ProviderCredential` (provider_id, credential_code). Providers select from valid codes during intake; the frontend renders chips using the patient_description.

**Rationale:** The credential reference table is the single source of truth for what Oregon recognizes. It prevents typos, enables consistent filtering, and — critically — gives patients the "what does this mean for me?" hover/tap text that the focus group asked for. The data is already researched and documented in `docs/ProviderCredentials_OralHealth_OR.md` (from the oral-health-providers project). New credentials (e.g., MSDH, Collaborative Agreement) can be added as seed data rows without schema changes. The many-to-many join is necessary because a provider like "RDH, EPDH, BSDH, LAP" holds four credentials.

**Alternatives considered:** Keep freeform JSON array — can't power the patient-description feature, allows invalid codes, no type categorization. Enum of credential codes — too rigid, adding a credential requires a migration instead of a seed data row.

---

## ADR-011: argon2id for password hashing (not bcrypt)

**Date:** 2026-03-20
**Status:** Accepted

**Context:** Sprint 0 included bcrypt in requirements.txt by default — it's the most common password hashing library in FastAPI tutorials. But this is a greenfield project with zero existing password hashes. The auth system hasn't been built yet (Sprint 2), so the cost of switching is zero today and grows with every sprint.

**Decision:** Use argon2id via `argon2-cffi` instead of bcrypt. Remove bcrypt from requirements.txt, add argon2-cffi. Set password_hash max_length to 255 to accommodate argon2id's ~97-char output with headroom.

**Rationale:** argon2id has been the OWASP recommendation since 2019. The key advantage is memory-hardness — bcrypt only costs CPU time per hash attempt, so attackers with GPU farms can parallelize cracking cheaply. argon2id forces each attempt to allocate a configurable amount of RAM, making GPU-parallel attacks dramatically more expensive. The Python API (`argon2-cffi`) is actually simpler than bcrypt's: `PasswordHasher().hash()` and `.verify()`, no manual salt handling. Since no auth routes exist yet and no hashes are stored, there is nothing to migrate. The switch is free now and gets more expensive every sprint.

**Alternatives considered:** bcrypt — battle-tested and fine for most apps, but weaker against modern GPU attacks. No reason to choose it when starting from zero with a better option available.