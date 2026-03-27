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

**Rationale:** This is a public directory. The entire purpose is for providers to publish their contact information and credentials. The data is intentionally public by design — it's displayed on the search page and profile page to anonymous visitors. Encrypting fields that are served unencrypted over a public API adds complexity with zero security benefit. The only sensitive credential is the password, which is argon2id-hashed (ADR-011). Login email (if different from public contact email) is access-controlled at the API layer, not encrypted at the field level. There is no medical/patient data anywhere in the system — no HIPAA applies.

---

## ADR-003: Approval flow with draft column for edit review

**Date:** 2026-03-19
**Status:** Accepted

**Context:** Provider profiles need admin approval before going live. When an already-approved provider edits their profile, those edits also need review.

**Decision:** `status` enum on the provider record for initial approval. `draft` JSON column for post-approval edits. Draft holds the proposed changes; live fields stay untouched until admin approves.

**Rationale:** This avoids a full versioning/history system. The draft column is nullable — null means "no pending edits." Admin queue is a single query: `WHERE status = 'PENDING' OR draft IS NOT NULL`. Conference mode (`AUTO_APPROVE=true`) bypasses the queue for initial signup but the edit-review flow still applies. Simple enough for one admin (Nicole) managing a manageable volume of Oregon providers.

**Alternatives considered:** Separate `provider_drafts` table with full history — overkill for MVP. Shadow copy of the whole profile row — doubles storage and query complexity for the same behavior.

---

## ADR-004: Nominatim geocoding API (revised — replaces static lookup table)

**Date:** 2026-03-21 (revised)
**Status:** Accepted (supersedes original ADR-004)

**Context:** The search page converts a city name, zip code, or address to lat/lng for Haversine distance queries. The original decision was a static lookup table of ~400 Oregon cities and ~500 zip codes mapped to centroid coordinates. But ORToothFairy (the prototype) already has a working geocoding implementation using Nominatim (OpenStreetMap's free geocoding API), and a real-world edge case makes the static table insufficient: traveling dental hygienists may live in Washington, Idaho, or California but serve Oregon patients. Their `max_travel_miles` field handles the filtering — but only if the system can geocode their non-Oregon zip code in the first place.

**Decision:** Use Nominatim (OpenStreetMap) for geocoding, ported from ORToothFairy's `GeocodingService`. Three input methods: direct lat/lng (no geocoding needed), zip code, or address. Nominatim is free, requires no API key, and covers the entire US (and world) — no need to curate a list of border zips. Haversine distance calculation runs in Python application code (not SQL), matching ORToothFairy's pattern: load approved providers with their locations, calculate distances, filter by both the user's search radius and the provider's `max_travel_miles`, sort by distance.

**Rationale:**

- **Cross-state coverage for free.** A hygienist in Vancouver, WA (zip 98660) who travels to Portland is a real use case. Nominatim geocodes any US zip — no guessing which border zips to include. The `max_travel_miles` field does the geographic filtering; the geocoder just needs to resolve the starting point.
- **Already proven.** ORToothFairy's `GeocodingService` + `SearchService` + `SearchController` are ~170 lines of C# that translate to ~100 lines of Python. Nicole wrote this code and understands every piece. The port is a translation exercise, not a design exercise.
- **Zero maintenance.** No JSON file of ~900 rows to source, validate, and keep current. Oregon occasionally adds or renames zip codes; Nominatim handles that upstream.
- **Haversine in application code, not SQL.** At OHP's scale (hundreds of providers, not millions), loading approved providers and calculating distances in Python is fast, testable, and readable. No PostGIS, no complex SQL, no mixing business logic into queries. If scale ever demands it, a bounding-box pre-filter in the SQL query is a simple optimization that doesn't change the architecture.

**Tradeoffs accepted:**

- **Runtime dependency.** Nominatim is an external HTTP call (~200–500ms per geocode). If it's down, zip/address search fails (lat/lng search still works since it skips geocoding). At OHP's scale and audience, this is acceptable — patients search from home on normal internet, not from a conference booth on flaky wifi. If Nominatim reliability ever becomes a problem, a caching layer or static fallback table can be added without changing the API contract.
- **Rate limiting.** Nominatim's usage policy asks for max 1 request/second and a descriptive User-Agent header. OHP's search volume (single-digit QPS at peak) is well within this. The `User-Agent` header is already set in the ORToothFairy implementation.
- **No autocomplete.** Nominatim's free API doesn't power a type-ahead search box. For MVP, the user types a zip or city and hits search. Autocomplete is a post-conference enhancement if needed (Mapbox or Google Places).

**What this changes in the sprint plan:**

- Drop: "Static Oregon geocoding data — JSON file or DB table of ~400 cities / ~500 zips with centroid lat/lng"
- Drop: "Geocode existing provider locations — backfill lat/lng from city/zip using the new lookup table, and geocode on save going forward"
- Add: Geocoding service (port from ORToothFairy's `GeocodingService`) — ~30 lines of Python, calls Nominatim for zip/address resolution
- Add: Geocode provider locations on save — when a provider adds/edits a location, call Nominatim to populate lat/lng from their address or zip
- Keep: Haversine distance query, but in Python application code rather than SQL

**Original decision (for the record):** Static lookup table of Oregon cities/zips with centroid coordinates. No external API. Fast, free, offline-capable. Rejected because it can't handle cross-state providers without manually curating border zips from neighboring states, and the maintenance burden is unnecessary when a working Nominatim implementation already exists.

---

## ADR-005: S3-compatible object storage for profile photos

**Date:** 2026-03-19
**Status:** Accepted

**Context:** Provider profile photos need to be stored somewhere accessible via URL.

**Decision:** S3-compatible object storage — either DigitalOcean Spaces ($5/month) or Cloudflare R2 (free tier). Decision deferred until deployment sprint. Both use the same `boto3` SDK calls.

**Rationale:** Photos don't belong in Postgres (binary blobs degrade query performance and complicate backups). S3-compatible storage is the industry standard: upload via SDK, store the URL in the database, serve directly from the CDN. Public-read ACL means no signed URL complexity. Either provider (DO Spaces, R2) works identically from the application code — only the endpoint URL changes in config.

---

## ADR-006: Session-based auth with server-side sessions in Postgres

**Date:** 2026-03-21
**Status:** Accepted

**Context:** Providers need to log in to create and edit their profiles. Nicole needs admin access (User.role enum (PROVIDER, ADMIN) on the separate User table — see ADR-009. Expandable if we ever need facility managers, ODHA staff, etc.). The auth system touches every authenticated endpoint and sets the security posture for the entire application.

**Decision:** Server-side sessions stored in Postgres, delivered to the browser via HTTP-only secure cookie. A `sessions` table holds active sessions (session_id, user_id, created_at, expires_at). Login inserts a row and sets the cookie. Logout deletes the row. Every authenticated request reads the cookie, looks up the session in Postgres, and loads the user. CSRF protection via a synchronizer token pattern (second cookie or header that the frontend sends explicitly on state-changing requests).

**Rationale:** Sessions use a whitelist model — a row exists if and only if the user is logged in. Logout is a DELETE, not an entry on a blacklist that needs pruning. The cookie is an opaque session ID; no user data, role, or secrets travel to the browser. The mental model is 1:1: one login = one row, one logout = one deletion. This matches the "backend-persistent data object" pattern Nicole is already comfortable with from ApplicationPipeline's session handling.

**Alternatives considered:**

- **JWT (access token + refresh token):** The FastAPI ecosystem's default path — more tutorials, built-in `OAuth2PasswordBearer` support, `python-jose` does the heavy lifting. But JWTs are valid until they expire regardless of logout. Real logout requires a revoked-tokens blacklist table that grows monotonically and needs periodic cleanup. The blacklist approach inverts the logic: tokens are valid by default, the table exists to say "except this one." At OHP's scale (dozens of providers, one backend server) the statelessness benefit is irrelevant, and the cleanup burden is a worse tradeoff than writing ~60–80 lines of session middleware without ecosystem handholding. **Fallback plan:** if session-based auth hits a wall during implementation, revert to the Sprint 1 tag and re-attempt with JWT. The User model, password hashing (argon2id, ADR-011), and registration flow are identical either way — only the session/token layer changes.

- **Third-party auth (Auth0, Clerk, Supabase Auth):** Least application code, most features for free (password reset, email verification, brute-force protection). But the User table becomes a shadow copy of an external record, registration requires syncing two sources of truth via webhooks, and every auth operation adds a network hop to a third party. At the ODHA conference, a provider standing at the signup booth can't wait for Auth0's webhook on conference wifi. The features these services provide for free (password reset, email verification) are explicitly post-conference backlog. **Fallback plan:** available as a last resort if both session-based and JWT approaches fail, but this is unlikely.

**CSRF note:** Cookie-based auth requires CSRF protection because the browser sends the session cookie automatically — a malicious page could forge state-changing requests on behalf of a logged-in provider. The synchronizer token pattern (a CSRF token the frontend includes explicitly on POST/PUT/DELETE requests, validated server-side) is implemented as a FastAPI dependency (`csrf_protect` in `dependencies.py`) rather than middleware — this lets the CSRF check reuse the session row already loaded by `get_current_user`, avoiding a second DB hit, and makes protected routes visible in Swagger via the lock icon. JWT-in-localStorage avoids this because JavaScript must manually attach the token, but that trades CSRF safety for XSS exposure — the wrong tradeoff.

<!-- Admin auth for Nicole:  -->

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