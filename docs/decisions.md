# Architecture Decision Records

## ADR-001: Monorepo with frontend/ and backend/

**Date:** 2026-03-19
**Status:** Accepted

**Context:** FindMyHygienist has a React/TypeScript frontend and a FastAPI/Python backend. We could use separate repos or a monorepo.

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
- **Haversine in application code, not SQL.** At FindMyHygienist's scale (hundreds of providers, not millions), loading approved providers and calculating distances in Python is fast, testable, and readable. No PostGIS, no complex SQL, no mixing business logic into queries. If scale ever demands it, a bounding-box pre-filter in the SQL query is a simple optimization that doesn't change the architecture.

**Tradeoffs accepted:**

- **Runtime dependency.** Nominatim is an external HTTP call (~200–500ms per geocode). If it's down, zip/address search fails (lat/lng search still works since it skips geocoding). At FindMyHygienist's scale and audience, this is acceptable — patients search from home on normal internet, not from a conference booth on flaky wifi. If Nominatim reliability ever becomes a problem, a caching layer or static fallback table can be added without changing the API contract.
- **Rate limiting.** Nominatim's usage policy asks for max 1 request/second and a descriptive User-Agent header. FindMyHygienist's search volume (single-digit QPS at peak) is well within this. The `User-Agent` header is already set in the ORToothFairy implementation.
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

- **JWT (access token + refresh token):** The FastAPI ecosystem's default path — more tutorials, built-in `OAuth2PasswordBearer` support, `python-jose` does the heavy lifting. But JWTs are valid until they expire regardless of logout. Real logout requires a revoked-tokens blacklist table that grows monotonically and needs periodic cleanup. The blacklist approach inverts the logic: tokens are valid by default, the table exists to say "except this one." At FindMyHygienist's scale (dozens of providers, one backend server) the statelessness benefit is irrelevant, and the cleanup burden is a worse tradeoff than writing ~60–80 lines of session middleware without ecosystem handholding. **Fallback plan:** if session-based auth hits a wall during implementation, revert to the Sprint 1 tag and re-attempt with JWT. The User model, password hashing (argon2id, ADR-011), and registration flow are identical either way — only the session/token layer changes.

- **Third-party auth (Auth0, Clerk, Supabase Auth):** Least application code, most features for free (password reset, email verification, brute-force protection). But the User table becomes a shadow copy of an external record, registration requires syncing two sources of truth via webhooks, and every auth operation adds a network hop to a third party. At the ODHA conference, a provider standing at the signup booth can't wait for Auth0's webhook on conference wifi. The features these services provide for free (password reset, email verification) are explicitly post-conference backlog. **Fallback plan:** available as a last resort if both session-based and JWT approaches fail, but this is unlikely.

**CSRF note:** Cookie-based auth requires CSRF protection because the browser sends the session cookie automatically — a malicious page could forge state-changing requests on behalf of a logged-in provider. The synchronizer token pattern (a CSRF token the frontend includes explicitly on POST/PUT/DELETE requests, validated server-side) is implemented as a FastAPI dependency (`csrf_protect` in `dependencies.py`) rather than middleware — this lets the CSRF check reuse the session row already loaded by `get_current_user`, avoiding a second DB hit, and makes protected routes visible in Swagger via the lock icon. JWT-in-localStorage avoids this because JavaScript must manually attach the token, but that trades CSRF safety for XSS exposure — the wrong tradeoff.

<!-- Admin auth for Nicole:  -->

---

## ADR-007: TypeScript on the frontend

**Date:** 2026-03-19
**Status:** Accepted

**Context:** ApplicationPipeline's frontend used JavaScript/React. FindMyHygienist is a chance to level up.

**Decision:** TypeScript for the frontend. React + TypeScript + Vite.

**Rationale:** Nicole wants to add TypeScript to her skillset. The API response types map naturally to TypeScript interfaces, which makes the frontend more self-documenting and catches bugs at compile time rather than runtime. Vite's TypeScript support is zero-config.

---

## ADR-008: Oregon-only scope, but don't hardcode it

**Date:** 2026-03-19
**Status:** Accepted

**Context:** FindMyHygienist launches in Oregon. Could it expand to other states?

**Decision:** Ship Oregon-only. But keep `state` as a field on provider locations rather than hardcoding "OR" everywhere. URL structure uses `/providers/or/:city` (state in the path). Search defaults to Oregon but the data model doesn't prevent other states.

**Rationale:** Zero extra work to keep the door open. The Nominatim geocoding approach (ADR-004, revised) already handles any US state — expanding beyond Oregon is a policy decision, not a technical one.

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

---

## ADR-012: Separate draft review lifecycle from directory visibility status

**Date:** 2026-03-28
**Status:** Proposed (implementation deferred to post-conference)

**Context:** The original data model uses a single `Provider.status` enum (PENDING, APPROVED, CHANGES_REQUESTED, SUSPENDED) for two unrelated concerns:

1. **Directory visibility** — is this provider's profile live on the public site?
2. **Draft review state** — whose turn is it to act on a pending profile edit?

This conflation creates a broken flow for already-approved providers. When an APPROVED provider submits a profile edit (which lands in the `draft` JSON column per ADR-003), and Nicole rejects the draft, the options are all wrong:

- Set status to CHANGES_REQUESTED → the provider **disappears from the directory**. Wildly disproportionate for "your updated bio has a typo."
- Set status to SUSPENDED → even worse.
- Leave status as APPROVED and... hope? → No mechanism to tell the provider their draft was rejected, no signal for Nicole's queue when the provider resubmits.

The conference flow (AUTO_APPROVE=true) masks this because Nicole handles problems via direct email, not through the app. But post-conference, when the review queue is the primary workflow, this gap becomes a daily pain point.

A related observation: **account suspension and profile visibility are also separate concerns.** A provider whose listing is suspended should still be able to log in and see "your listing is suspended" with an explanation. A provider whose *account* is locked (repeated abuse, unresponsive after warnings) shouldn't be able to log in at all. The current model has `User.is_active` (bool) and `Provider.status = SUSPENDED` but doesn't cleanly articulate the escalation path.

**Decision:** Three independent axes, three independent fields:

### 1. `Provider.status` — directory visibility (existing field, narrower scope)

Controls whether the profile appears in public search results and the public profile endpoint. Values:

| Value | Meaning | Visible to patients? |
|-------|---------|---------------------|
| `PENDING` | New signup, never reviewed | No |
| `APPROVED` | Live on the directory | Yes |
| `SUSPENDED` | Pulled from directory by admin | No |

**Removed:** `CHANGES_REQUESTED` moves out of this enum — it was never about visibility, it was about draft review state. For *pre-approval* first reviews, PENDING already covers "not yet approved." If Nicole wants the provider to fix something before first approval, she sets a message (see admin_message below) and status stays PENDING. The provider edits their live fields (nothing is live yet), and re-enters the queue as PENDING.

<!-- Wait — this means we need a signal for "I looked at this PENDING
     provider and they need to fix something, don't show them to me
     again until they've edited." That's the same turn-tracking problem
     as drafts. See draft_status discussion below — same solution
     applies: PENDING + draft_status = CHANGES_REQUESTED means Nicole
     reviewed it and kicked it back. PENDING + draft_status = null or
     REVIEW_NEEDED means it's Nicole's turn to look. -->

### 2. `Provider.draft_status` — whose turn is it? (new field)

Nullable enum on Provider. Null when there's no pending review action. Values:

| Value | Meaning | Whose turn? |
|-------|---------|-------------|
| `null` | No pending review | Nobody |
| `REVIEW_NEEDED` | Provider submitted something for review | Nicole's turn |
| `CHANGES_REQUESTED` | Nicole reviewed and kicked it back | Provider's turn |

The lifecycle for **post-approval edits** (APPROVED providers):

```
Provider edits profile
  → draft populated, draft_status = REVIEW_NEEDED
  → appears in Nicole's admin queue

Nicole reviews draft:
  Option A: Approve
    → draft fields merged into live profile
    → draft = null, draft_status = null
  Option B: Request changes
    → draft_status = CHANGES_REQUESTED
    → admin_message set with explanation
    → provider sees message, edits draft
    → draft_status flips back to REVIEW_NEEDED
    → back in Nicole's queue
```

The lifecycle for **first-time approval** (PENDING providers):

```
Provider registers
  → status = PENDING, draft_status = REVIEW_NEEDED
  → appears in Nicole's admin queue

Nicole reviews:
  Option A: Approve
    → status = APPROVED, draft_status = null
  Option B: Request changes
    → status stays PENDING, draft_status = CHANGES_REQUESTED
    → admin_message set with explanation
    → provider edits live fields (nothing is live yet)
    → draft_status flips back to REVIEW_NEEDED
    → back in Nicole's queue
```

**Nicole's complete admin queue query:**

```sql
SELECT * FROM providers
WHERE draft_status = 'REVIEW_NEEDED'
ORDER BY updated_at ASC;
```

One query. No date math. No conditional logic. `REVIEW_NEEDED` means "Nicole hasn't looked at this yet" regardless of whether it's a new signup or an edit to an existing profile.

### 3. `User.is_active` — account lockout (existing field, unchanged)

Bool on User. False = can't log in. This is the nuclear option for accounts that need to be fully locked out (unresponsive after warnings, abuse, etc.).

**Escalation path:**

1. Nicole emails the provider directly (outside the app) — informal, conference-appropriate
2. `Provider.status = SUSPENDED` — profile hidden from directory, provider can still log in and see "your listing is suspended" + admin_message
3. `User.is_active = False` — full account lockout, can't log in at all

### 4. `Provider.admin_message` — communication channel (new field)

Text column, nullable. Set by admin when requesting changes or suspending. Cleared when the provider resubmits or when admin approves. The provider dashboard shows this message — "Nicole says: please remove the phone number from your bio, it belongs in the contact section."

<!-- This was already flagged in remaining-sprints.md (admin sprint) comment:
     "Provider has no field for that message yet. Decide here: either add
     an admin_message text column on Provider (simplest), or stash it
     in the draft JSON blob." Decision: dedicated column. The message
     is about the provider's relationship with admin, not about any
     specific set of field edits. It survives draft approval/rejection
     cycles. -->

**Rationale:**

- **No date inference.** The original plan required comparing draft timestamps against admin action timestamps to determine whose turn it was and whether to re-notify. That's fragile, hard to query, and creates edge cases around timezone handling and "what if the provider saves without changing anything?" A dedicated status field is unambiguous.
- **Queue query is trivial.** One WHERE clause, not a conditional expression. This matters because the admin queue is the most-used admin page.
- **Backwards-compatible.** `draft_status` is nullable — null means no review pending. Existing providers (from conference) have no draft and no draft_status, which is correct. The new field only activates when the review workflow is actually used.
- **CHANGES_REQUESTED moves to the right place.** It was never a visibility state. It's a turn-tracking state. Putting it on `draft_status` instead of `status` means an APPROVED provider asking for a bio tweak stays live on the directory the entire time.

**Migration plan (post-conference):**

1. Add `draft_status` column (VARCHAR, nullable) to providers table
2. Add `admin_message` column (TEXT, nullable) to providers table
3. Remove `CHANGES_REQUESTED` from `ProviderStatus` enum in Postgres
   - If any existing rows have status = CHANGES_REQUESTED, migrate them to PENDING + draft_status = CHANGES_REQUESTED first
   - Alembic: ALTER TYPE providerstatus RENAME VALUE... (Postgres doesn't support DROP VALUE from enums cleanly — may need to recreate the type. Cross that bridge post-conference.)
4. Set `draft_status = REVIEW_NEEDED` on any existing rows where `status = PENDING` (conference signups that Nicole hasn't reviewed yet)
5. Update profile_service.py: `update_provider_profile` sets `draft_status = REVIEW_NEEDED` when writing to draft
6. Build admin endpoints that consume draft_status

**Alternatives considered:**

- **Separate `provider_reviews` table with full audit log:** Every review action (approve, request changes, resubmit) gets a timestamped row. More data, full history, supports "show me the review conversation." But overkill for one admin reviewing tens of providers. The admin_message + draft_status fields handle the 99% case. If audit history ever matters, it can be added without changing the status/draft_status model — just log the transitions. — maybe post-launch
- **Boolean `draft_needs_review` instead of an enum:** Simpler, but can't distinguish "provider submitted, Nicole hasn't looked" from "Nicole looked and kicked it back." The provider needs to know whether they're waiting on Nicole or Nicole is waiting on them. Two-value enum is the minimum viable model.
- **Reuse the draft JSON blob for admin messages:** Stash `{"_admin_message": "fix your bio"}` inside the draft. Avoids a new column but conflates content (the edits) with metadata (the review conversation). The message should survive draft approval — "I approved your changes, but heads up for next time..." — which doesn't make sense inside a blob that gets set to null on approval.

---

## ADR-013: Location visibility — is_public flag and dual-purpose locations

**Date:** 2026-03-30
**Status:** Accepted

**Context:** Provider locations serve two purposes that can conflict: **findability** (radius search needs a geocodable address) and **display** (patients see where the provider practices). EPDHs and other traveling providers need to appear in location-based searches but shouldn't expose their home address. Dentists searching for hygienists to hire also use radius search — so the privacy concern applies broadly, not just to patient-facing searches. Meanwhile, providers with public practice sites (offices, clinics, school programs) *want* those locations displayed on their profile. The original ProviderLocation model has no way to distinguish these cases.

**Decision:** Add `is_public` boolean column on `provider_locations`, default `True`. This single flag separates the two concerns:

- **Public locations** (`is_public=True`): Visible on the provider's public profile as label + city + state (never full address — see "What's exposed publicly" below). Also used for radius search.
- **Private locations** (`is_public=False`): Invisible on the public profile entirely — no label, no city, nothing. Used only for radius search behind the scenes. The provider sees them on their own dashboard.

**What's exposed publicly:** For `is_public=True` locations, the public API returns `label`, `city`, and `state` only. `address_line1`, `address_line2`, `zip_code`, `latitude`, and `longitude` are never sent through the public profile endpoint. This is enforced at the response schema level — `PublicLocationResponse` simply doesn't include those fields. If providers later ask for full addresses to be displayed (e.g., a dentist who wants patients to have their office address), that's a schema change, not a data model change. Easy to open up, impossible to accidentally leak.

<!-- Zip-code-derived coverage lists (like Psychology Today's "serves
     these zip codes" section) can be calculated from the provider's
     locations + max_travel_miles at query time. No new data needed —
     it's a display feature built on top of the existing model. Post-conference
     if anyone asks for it. -->

**Migration (Sprint 5):**

1. Add `is_public` column (BOOLEAN, NOT NULL, DEFAULT TRUE) to `provider_locations`
2. Make `city` nullable on `provider_locations` — zip-code-only private locations won't always have a city (geocoding in Sprint 11 can backfill it from the zip)

**Rationale:**

- **One table, one flag.** A public office and a private home base are the same shape of data — address, label, coordinates. Splitting them into separate tables doubles the CRUD, doubles the search query joins, and creates a "which table do I add this to?" UX decision that maps poorly to how providers think about their locations. A boolean on the existing table is the minimum viable distinction.
- **Default public.** Most locations are practice sites that providers want displayed. The private case (traveling from home) is the exception that needs an explicit opt-out, not the default. This keeps the intake flow simple for the common case (dentist entering an office address) while still supporting the EPDH case.
- **Search uses all locations regardless of is_public.** Sprint 12's search service queries `provider_locations` without filtering on `is_public` — a private home-base location still puts the provider in radius results. The flag only affects what appears on the public profile.
- **No address exposure on public profiles yet.** Even for public locations, showing label + city + state is enough for MVP. Patients see "Community Health Center — Salem, OR" and contact the provider directly. Full address display is a future opt-in if providers request it. Starting restrictive and opening up is safer than the reverse.

**Alternatives considered:**

- **Separate `private_locations` table for travel bases:** Cleaner separation of concerns, but doubles CRUD and complicates Sprint 12's search query (UNION or two joins). The data shape is identical — a table split is organizational, not structural. The boolean achieves the same result with less code.
- **No is_public flag — just never show locations publicly, rely on radius search only:** Simpler, but throws away the "Main Office — Portland, OR" display that builds trust on profiles. Providers with public practices want that visibility. The flag lets each provider decide per-location.
- **Provider-level visibility toggle instead of per-location:** A single "show my locations" toggle on the Provider record. Simpler, but doesn't handle the mixed case (EPDH who travels from home AND works at a clinic). Per-location granularity is the right level.

**Frontend guidance (Sprint 6 implementation):**

The intake form should contextually guide providers toward appropriate location setup based on their situation. Two patterns:

1. **Traveling/mobile providers (EPDH, mobile hygienists):** The form should lead with something like "Where do you travel from?" with helper text: *"This helps patients near you find you in search — it won't appear on your profile."* `is_public` pre-unchecked. Address fields relaxed — entering just a zip code is sufficient (geocoding backfills city/coordinates in Sprint 11). Label defaults to "Travel base" or similar, editable. Below this, an "Add a practice location" option for any public sites they also serve.

2. **Fixed-location providers (dentists, clinic-based hygienists):** The form leads with the office address, `is_public` checked by default, guided label suggestions ("Main Office", "Community Health Center", "School-Based Program", plus freeform). The private/travel option is available via "Add another location" but not front-and-center.

<!-- The provider_type enum drives which pattern the form presents first,
     but any provider can add both public and private locations regardless
     of type. A dentist might have a home office they don't want listed;
     an EPDH might have a clinic they do. The form guides, not restricts. -->

The `is_public` checkbox should use friendlier copy than "is_public" — something like **"Show on my profile"** with helper text that explains what happens in each state. When unchecked: *"This location is used for search only. Patients won't see it."* When checked: *"Patients will see this location's name and city on your profile."*

---

## ADR-014: Single Accordion Intake Form

**Date:** 2026-04-01
**Status:** Accepted

**Context:** The provider signup/intake form needs to work in two very different contexts: a conference booth (fast, phone, no bio or headshot handy) and organic web traffic (sitting at home, ready to build a full profile). PsychologyToday-style directories need completeness, but asking for everything upfront at a conference booth means people bounce.

**Decision:** One intake form, two speeds. The form is a 3-step wizard (URL stays `/join`, steps managed by React state, no routing per step). Accordions handle optional fields within the heavy step.

**Wizard Steps:**

1. **Account creation** — name, email, password, provider_type, "Home Base" city or zip (private, for search radius, label "Based in"), accepting_new_patients=true, max_travel_distance dropdown with default=25mi. POST register + POST location + PATCH profile. Hard save. One screen = findable.

2. **Profile fields** — Microcopy: "You're findable! Patients can see your profile in search results. Add contact info below so they can reach you." Ten accordion sections, ordered by importance:
   1. Photo (closed) — focus group asked for this first
   2. Bio & title line (closed)
   3. Credentials (OPEN) — CredentialSelector component
   4. Contact preferences (OPEN) — phone, public email, website
   5. Specialties, services & populations served (closed)
   6. Travel from & practice locations (closed) — LocationEntry component
   7. Insurance accepted (closed)
   8. Languages (closed)
   9. Availability & scheduling preferences (closed)
   10. Tags & additional info (closed)

3. **Confirmation** — not a save. Fetches GET /api/me/profile, renders based on status: if APPROVED show "You're live!" with public profile link; if PENDING show "Your profile is pending review" with dashboard link.

**Rationale:**

- **Conversion at the booth matters more than completeness at signup.** We can't sell the platform to ODHA if providers bounce off a 15-field form while standing in line.
- **One form forever** avoids maintaining two flows and two sets of validation logic.
- **Accordions show feature depth** to potential paying customers without punishing fast signups. Closed accordions are a promise, not a demand.
- **No nag pattern.** No "Complete your profile!" push emails or banners. A silent progress bar on the dashboard (Sprint 9+) gives the same information without emotional manipulation.
- **Photo first** because users told us to. Focus group's first reaction was about photos — that's data, not a guess. But closed by default because providers invest seriously in their professional image.
- **Home base in Step 1** means one screen = findable. Conference booth providers can stop after Step 1 and still appear in search.
- **Status-based confirmation** decouples frontend from backend config, survives future approval workflow changes.

**Consequences:**

- Profiles will be sparse initially. Search/matching quality depends on how many providers fill out specialties and locations later. Dashboard progress bar is the gentle nudge.
- Accordion label copy is doing real work (UI affordance + sales copy). Worth spending time on wording.
- Dashboard must include profile editing flow so providers can come back and fill in what they skipped.

---

## ADR-015: Patient-facing search — two tracks: categorized tag browsing + full-text search

**Date:** 2026-04-03
**Status:** Accepted

**Context:** FindMyHygienist needs a patient-facing search that surfaces providers based on what makes them special — the bios, tags, credentials, and comfort markers that providers asked for in focus group #1 (12/18/24). The focus group's core request was "let patients find me for what I actually offer," which means the tags ("anxiety aware," "judgment-free," "LGBT sensitive") need to be browsable, not just stored. Full-text search over bios and mission statements is valuable too, but requires content — and profiles will be sparse at first. Both approaches are planned; they compose together.

**Decision:** Two parallel search tracks, prioritized by what works with sparse data. Both compose with distance/location filtering and accepting_new_patients. Both are designed now; both ship based on available time before the conference.

**Track 1 (priority): Filter-driven search with categorized tag browsing**

Works even when providers have filled out only tags and credentials — the conference-booth minimum.

- **`tag_categories` reference table:** `code` (PK), `display_name`, `sort_order`. 4–6 patient-facing categories: Comfort & Approach, Populations Served, Services, Languages, etc. Curated by Nicole — same pattern as the credentials reference table (ADR-010).
- **`tag_to_category` lookup table:** `tag_text`, `category_code` (FK). Maps each provider tag to a category. Tags without a mapping go into an "Other" bucket. Initial seed is a best-guess from focus group data and the ORToothFairy prototype; refined after real provider data exists.
- **Search page UX:** Category headers, tappable chips within each. Patients scan the category that matches their concern, tap chips to filter. Multiple selections supported (AND within a category, OR across categories — or start with AND everywhere and see if it's too restrictive). No typing required, no blank-page problem, no need for patients to guess vocabulary.
- **Filter composition:** Tag chip selections compose with credential filter, distance/location, and accepting_new_patients as AND clauses. A patient who taps "anxiety aware" + "pediatric" + selects "within 25 miles" gets providers matching all three.

<!-- The tag list is self-curating — only tags that at least one approved
     provider has actually used will appear as chips. Sort chips within
     each category by frequency (most providers first) so the popular
     ones float to the top. At launch scale this is fine; if the tag
     universe explodes post-conference, add a "show more" cutoff per
     category. -->

**Track 2: Full-text search over provider content**

Becomes more valuable as providers flesh out bios and mission statements.

- **Text search column:** Generated `tsvector` column on the provider table built from `bio || ' ' || headline || ' ' || mission_statement`. GIN index. `ts_rank` for result ordering.
- **Tag inclusion in tsvector:** Include the tag array (cast to text) in the tsvector so full-text search matches against tags as well as free text. A patient typing "anxiety" hits both the bio and the "anxiety aware" tag.
- **`pg_trgm` extension:** Trigram similarity for fuzzy matching (typos, partial words). Ships with Postgres, just needs `CREATE EXTENSION`.
- **Compose with tag browsing:** Text search results are AND-composed with any active tag/credential/distance filters. The search box enhances the chips, doesn't replace them.

<!-- Full-text search won't understand that "I'm embarrassed I haven't
     been to the dentist" should match a provider whose bio says "gentle,
     non-judgmental approach." That's the gap ADR-016 closes over time
     by enriching provider tags from search log analysis. If tsvector
     proves inadequate even with enriched tags, pgvector embeddings are
     the next step — but that's a new ADR, not a revision of this one. -->

**Search log table (ships with whichever track lands first):**

Every search is logged regardless of search mode: `search_id` (PK), `query_text` (nullable — null for filter-only searches), `filters_applied` (JSONB — tags selected, credentials, distance, etc.), `result_provider_ids` (integer array), `result_count`, `created_at`. This table serves three purposes:

1. **ADR-016 input.** The batch tag suggestion pipeline reads this table to find gaps between what patients look for and what providers list.
2. **Product analytics.** Top tag combinations, zero-result filters, and filter-to-profile-click conversion tell us what patients want and what the directory is missing.
3. **Partnership data.** "Here's what Oregonians look for in a dental hygienist" is a slide for ODHA that nobody else can make.

<!-- No PII in the search log. Logs what was searched, not who searched.
     No patient accounts, no IP logging. If we ever add patient accounts,
     the search log stays anonymous. -->

**Rationale:**

- **Tag browsing works with sparse data.** At the conference, most providers will have tags and credentials but minimal bios. Categorized chips surface what exists. Full-text search becomes more valuable as profiles fill out — they complement each other.
- **Both compose with the same distance/filter infrastructure.** The core search endpoint (Haversine, provider_type, accepting_new_patients) is shared. Tag filtering and text search are additive WHERE clauses, not separate code paths.
- **Zero marginal cost for both.** Tag filtering is a WHERE clause. tsvector + GIN is built into Postgres. No LLM calls, no embedding API, no external search service.
- **Category curation is small and valuable work.** At launch with a few dozen providers, the tag universe is manageable. Nicole maintains the `tag_to_category` mapping manually — same as the credentials reference table. When ADR-016's batch pipeline starts suggesting new tags, those suggestions can include a proposed category.
- **Search log starts collecting from day one.** Whichever track ships first, the log captures what patients search for. This feeds ADR-016 and product decisions regardless of which search features are live.

**Alternatives considered:**

- **LLM per query (Claude as search engine):** Best possible matching quality. But at ~$0.01–0.05 per search with zero revenue and unknown query volume, this is a cost bomb with no cap. Revisit when there's a paid tier. (See ADR-016 for the batch alternative that gets 80% of the benefit at 1% of the cost.)
- **Embeddings + vector similarity (pgvector):** Better semantic matching than tsvector, still cheap per query. But it's a new dependency (pgvector extension, embedding model, API key), and the corpus at launch is too sparse for embeddings to outperform tag filtering. If full-text search proves inadequate and ADR-016's tag enrichment doesn't close the gap, pgvector is the next step.
- **External search service (Algolia, Meilisearch, Typesense):** Purpose-built search with typo tolerance and faceting. Genuinely good at scale. But it's another service, another sync, another bill, and another thing that can go down. At a few hundred providers, Postgres handles both tracks and one fewer moving part wins.
- **Flat tag list (no categories):** Dump all chips on the page, let patients scroll. Works at 10 tags, unwieldy at 50+. Patients scanning a wall of chips have the blank-page problem — they don't know where to start. Category headers give them an entry point: "I have a comfort concern" → scan Comfort & Approach. Minimal implementation cost for a real UX improvement.
- **Provider-categorized tags (provider picks the category when adding a tag):** Free taxonomy maintenance, but inconsistent results — "is 'pediatric' a population or a service?" Nicole-curated categories keep the patient-facing grouping coherent, same rationale as the credentials reference table (ADR-010).

---

## ADR-016: Batch tag suggestion pipeline — search log → Claude → practitioner review

**Date:** 2026-04-03
**Status:** Accepted
**Depends on:** ADR-015 (search log table)

**Context:** ADR-015's full-text search can match words but can't bridge the vocabulary gap between how patients describe what they need and how providers tag themselves. A patient searching "I haven't been to the dentist in ten years" needs a provider whose bio radiates non-judgment — but if that provider tagged themselves "adult care" and "comprehensive exams" instead of "judgment-free" or "dental anxiety," there's no match. The intelligence to close that gap exists (LLMs are good at this), but running it per-query is too expensive pre-revenue. Running it in batch on a schedule is cheap and produces a durable artifact: better provider tags.

**Decision:** A periodic batch job reads the search log, sends all provider profiles + recent search queries to Claude, and gets back suggested tags that providers *should* be listing based on what their bios and existing profiles imply. Suggestions go to providers for review — not auto-applied.

**Pipeline:**

1. **Trigger:** Manual initially (Nicole runs it). Automated later on a cadence/threshold combo: weekly OR every 200 new search log entries, whichever comes first. The trigger logic lives in a config, not hardcoded.

2. **Input assembly:** Pull all provider records (profiles + existing tags + credentials). Pull search log entries since the last batch run. Bundle into a single prompt.

<!-- At 200 providers × ~500 tokens each = ~100K tokens of provider data,
     plus search log summary. Fits comfortably in Claude's context window.
     At 2,000 providers, split by provider_type or region and run multiple
     batches. At 4,000, still fine split into 4 batches. This scales to
     the realistic ceiling of Oregon hygienists. -->

3. **Claude call:** One API call (or a small number of batched calls if the corpus is split). Prompt asks Claude to:
   - Identify tags that providers are missing based on what their bio/mission/credentials imply
   - Map patient search vocabulary to provider self-description vocabulary
   - Return structured JSON: `[{provider_id, suggested_tags: [{tag, reasoning}]}]`
   - Model: use whatever's cheapest that handles the context well. Haiku with prompt caching is the target — cache the provider corpus (pay the write once), pay the read rate per batch run. Estimated cost: under $5/month even with weekly runs.

4. **Suggestion storage:** New table `tag_suggestions`: `id`, `provider_id` (FK), `suggested_tag`, `reasoning`, `batch_id`, `status` (enum: PENDING, ACCEPTED, REJECTED, EXPIRED), `created_at`, `reviewed_at`. Batch ID groups suggestions from the same run for auditing.

5. **Provider review flow:** Provider dashboard shows a notification: "We have tag suggestions for your profile." Each suggestion shows the tag and the reasoning ("Patients are searching for 'dental anxiety' and your bio mentions 'gentle, non-judgmental approach' — consider adding this tag"). Provider can accept (tag added to their profile), reject (tag dismissed, not re-suggested for the same reasoning), or ignore (expires after 30 days, may be re-suggested in a future batch if the signal persists).

<!-- The 3-day review window from the original conversation is now 30 days.
     Providers are busy. 3 days felt like a deadline; 30 days feels like
     an invitation. Auto-expire + potential re-suggestion means nothing
     is lost by waiting. -->

6. **Feedback loop:** Accepted and rejected suggestions inform future prompts. "Provider X rejected 'pediatric' — their bio mentions children but they don't see pediatric patients" is a valuable negative signal for the next batch.

**Rationale:**

- **Cost-capped by design.** Batch frequency is configurable. At $5/month ceiling with weekly runs, this is a rounding error. If it creeps above that, reduce frequency or switch to a cheaper model. The trigger threshold (every 200 searches) means quiet periods don't burn money on redundant runs.
- **Providers own their profiles.** Nothing is auto-applied. The suggestion + reasoning pattern respects practitioner autonomy and builds trust. "We noticed patients are searching for X and your profile suggests you offer this" is a *delightful* notification, not an imposition.
- **Improves ADR-015 search quality without changing ADR-015.** Better tags mean better tag browsing matches and better full-text search matches. The search architecture doesn't need to get smarter — the data it searches gets richer. This is the cheapest possible way to improve search quality.
- **The search log is the moat.** Competitors can copy the directory. They can't copy "what Oregon patients actually search for" because they don't have the traffic. This pipeline turns traffic into data into better matching into more traffic.

**Alternatives considered:**

- **Auto-apply tags with opt-out:** Faster profile improvement, but violates practitioner trust. A hygienist who sees tags they didn't choose on their public profile will be angry, and rightly so. Especially for sensitive tags ("LGBT sensitive") where the provider may support the community but not want it as a public profile tag for personal safety reasons. Opt-in only.
- **Real-time per-query LLM matching (skip the tags entirely):** Best search quality, worst cost profile. And it doesn't produce the durable artifact — if the LLM goes down or gets too expensive, you lose the intelligence. Batch-generated tags persist in the database forever. The intelligence is baked into the data, not rented per-query.
- **Provider self-service tag suggestions (no LLM):** Show providers the top search queries and let them self-select matches. Cheaper than Claude, but providers don't think in patient vocabulary — that's the whole problem this pipeline solves. The LLM is the translator between patient-speak and provider-speak.
- **Embedding-based auto-tagging:** Embed the tag taxonomy + provider bios, find nearest tags by cosine similarity. Cheaper than Claude per run, but can't explain *why* a tag is suggested. The reasoning field is doing real work in the provider review UX — it's the difference between "add this tag" and "here's why this tag fits you." Claude provides the reasoning; embeddings don't.

**Future:**

- If/when FindMyHygienist has a paid tier, real-time LLM search becomes viable as a premium feature. The batch pipeline still runs underneath to improve free-tier search.
- The `tag_suggestions` table + acceptance rate is a natural A/B testing surface: "do Claude-suggested tags improve search-to-click conversion?"

---

## ADR-017: Subdomain deployment with shared-domain cookies

**Date:** 2026-04-04
**Status:** Accepted

**Context:** Sprint 10 deployed the frontend and backend as separate Railway services. Each Railway service gets its own generated domain (e.g., `ohp-frontend-production.up.railway.app` and `ohp-backend-production.up.railway.app`). The auth system uses HTTP-only session cookies and a CSRF synchronizer token cookie (ADR-006). Cookies set by the backend on one Railway domain are invisible to the frontend on a different Railway domain — cross-origin cookies are blocked by default in modern browsers, and even with SameSite=None they require explicit CORS credential handling that's fragile and browser-dependent.

**Decision:** Deploy both services under subdomains of `findmyhygienist.org`: frontend at `findmyhygienist.org`, backend at `api.findmyhygienist.org`. Set `cookie_domain='.findmyhygienist.org'` in the backend config so session and CSRF cookies are scoped to the parent domain and visible to both subdomains. The frontend reads `VITE_API_URL` at build time to construct API requests to `api.findmyhygienist.org`. DNS is configured with CNAME records pointing each subdomain to its Railway service.

**Rationale:**

- **Same cookie domain = same auth behavior as local dev.** In dev, Vite proxies `/api/*` to `localhost:8000`, so everything is same-origin. The subdomain approach preserves this: both subdomains share `.findmyhygienist.org` cookies, so the browser sends the session cookie and CSRF token on every API request without any cross-origin gymnastics. No changes to ADR-006's auth flow.
- **CSRF stays strict.** The CSRF synchronizer token (set as a cookie by the backend, read from `document.cookie` by the frontend, sent as an `X-CSRF-Token` header) works because both services share the parent domain. A malicious site on a different domain cannot read the CSRF cookie, so the protection holds. If the services were on fully separate domains, CSRF delivery would need to switch to response-body delivery — unnecessary complexity.
- **Clean separation for future scaling.** `api.findmyhygienist.org` can move to a different host without touching the frontend DNS. A `dev.findmyhygienist.org` subdomain is available for staging.
- **`cookie_domain` is config, not code.** The setting lives in `config.py` as an optional field (defaults to `None` for local dev, set to `'.findmyhygienist.org'` in Railway env vars). No hardcoded domain strings in application code.

**What this adds:**

- `config.py`: `cookie_domain: str | None` field, defaults to `None`
- `routes/auth.py`: login and logout set `domain=settings.cookie_domain` on both the session cookie and the CSRF cookie
- `client.ts`: `API_BASE` reads `VITE_API_URL` env var at build time (falls back to `/api` for dev)
- DNS: CNAME records for `findmyhygienist.org` and `api.findmyhygienist.org` pointing to their respective Railway services
- Railway: `COOKIE_DOMAIN=.findmyhygienist.org` and `VITE_API_URL=https://api.findmyhygienist.org` env vars

**Alternatives considered:**

- **Reverse proxy (single domain, path-based routing):** Serve both frontend and backend behind one domain with `/api/*` routed to the backend. Eliminates the cross-subdomain problem entirely. But Railway's service model doesn't natively support path-based routing to different services without an extra proxy layer (nginx, Caddy, or Railway's edge config). Adding a proxy service increases cost and operational surface for a problem that subdomain cookies solve cleanly.
- **Cross-origin cookies with SameSite=None + Secure + CORS credentials:** Keep Railway's generated domains and configure CORS with `Access-Control-Allow-Credentials: true`. Works in theory but is fragile — Safari and Firefox have increasingly strict third-party cookie policies, and `SameSite=None` requires the user to not have third-party cookies blocked. A directory that breaks when a provider has a privacy extension installed is not a good first impression at a conference booth.