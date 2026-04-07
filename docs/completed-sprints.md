# Completed Sprints

<!-- Move sprint sections here from remaining-sprints.md as they ship.
     Include the actual date range, any deviations from plan, and
     links to relevant commits or PRs. Latest sprints are at the top. -->


---

## Sprint 13 — Search Page (= Landing Page) — Frontend (Day 19) 4/6 5:15p

**Goal:** The search page IS the landing page. Visitors hit `findmyhygienist.org` and see example providers in result cards — the directory looks alive. They search, and the examples step aside for real results. This is the second conference demo surface (after the profile page).

- [x] Extend client.ts with typed API wrappers: `apiSearchProviders` (query params + pagination return type — different shape from existing path-based wrappers), `apiGetProviderTypes`
- [x] Landing state (no search query yet) — fetch example providers via `GET /api/providers?featured=true`, render in result cards. Headline copy that signals what the directory is ("Oregon's dental hygienists, in their own words" or similar). Search bar above, example profiles below as showcase.
- [x] Active search state (user entered zip/city) — fetch real results from `GET /api/providers` (example-profile providers excluded automatically by backend). Result cards with truncated bios above the fold, provider photo + name + credential chips + contact.
- [x] "List with us" CTA for providers visiting the search page
- [x] Location input — zip code field (primary), city name, or browser geolocation button
- [x] Radius selector (5, 10, 25 miles, or "show all")
- [x] Filter dropdowns wired to `/api/providers/types` (specialties dropdown deferred to post-conference semantic search)
- [x] Route change: `/` renders Search (retire Home.tsx stub). Keep `/providers/or/:city` as an alias or redirect if needed for SEO later.
- [x] Educational triage stub text on search page (placeholder content, not interactive)

<!-- The Search component handles both states — landing (featured
     providers) and active search (real results). Single component,
     two states. No separate Home page to maintain.

     seed_demo.py providers are the landing state content. They
     exercise different feature paths (mobile, multi-location,
     bilingual, anxiety-aware) so the landing page showcases
     the directory's range. -->

---

## Sprint 12 — Search API Core — Backend (Day 19) - DONE 4/6 12:29p

**Goal:** Core search endpoint fully testable via Swagger / curl before frontend work begins. This is the ORToothFairy port — the C# is the spec, and the output is a working distance+filter search. One context window.

- [x] Search service — port from ORToothFairy's `SearchService` (Haversine in application code, filters by user search radius AND provider `max_travel_miles`)
- [x] `GET /api/providers` — three input methods (lat/lng, zip, address), plus filters (provider_type, credential, accepting_new_patients, tag, insurance, pagination). Returns approved providers only. Excludes `example-profile` tagged providers by default; `featured=true` param returns *only* example providers (powers the landing state in Sprint 13).
- [x] `GET /api/providers/types` etc — for filter dropdowns
- [x] `search_log` table + migration — `search_id`, `query_text` (nullable), `filters_applied` (JSONB), `result_provider_ids`, `result_count`, `created_at`. No PII. Feeds ADR-016 and product analytics. Log every search query (fire-and-forget, doesn't block response).
- [x] Tests — Haversine math, filter combinations, pagination, empty results, search logging, example-profile exclusion + featured filter

<!-- The core search is a translation sprint — the C# is the spec.
     ~170 lines of C# → ~100 lines of Python. Search log rides along
     because it's one table + one fire-and-forget insert, not a
     separate shape of work. Tag filtering and full-text search are
     separate context windows (post-conference). -->

---

## Sprint 11 — Geocoding — Backend (Day 17) - DONE 4/4 1:45p

**Goal:** Providers get lat/lng on their locations so search can find them by distance. Pure backend — wire Nominatim into location saves and backfill existing records.

- [x] Geocoding service — port from ORToothFairy's `GeocodingService` (~30 lines Python, calls Nominatim for zip/address → lat/lng)
- [x] Wire geocoding into provider location saves — when a provider adds/edits a ProviderLocation, call Nominatim to populate lat/lng from address or zip (ADR-004 revised)
- [x] Backfill lat/lng on existing provider locations (one-time script or migration data fix) - or, I can re-seed using my seed script / revised seed script if that's easier, there are no real customers in either the dev or prod database right now
- [x] Tests for geocoding service (mock Nominatim responses, verify lat/lng population on save)

---

## Sprint 10 — Early Deploy (Day 16) - DONE 4/4 10:17a

**Goal:** App is live on Railway behind `findmyhygienist.org`. AutoUpdate (CD) is on — every push to main deploys automatically. No feature work in this sprint, just infrastructure. CI logged as tech debt.

- [x] ohp-app -> FindMyHygienist name change and conference branding
- [x] Github main and dev branch and commit behavior change
- [x] Backend prep: `Procfile` (`uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}`), confirm `requirements.txt` is current, confirm DATABASE_URL handling (SQLAlchemy wants `postgresql://` not `postgres://`)
- [x] Frontend prep: `npm install serve --save-dev`, add `"start": "serve dist -s -l tcp://0.0.0.0:${PORT:-3000}"` to package.json scripts
- [x] Railway: create **backend** service from GitHub repo (set root directory), wire DATABASE_URL reference from existing Postgres service, add SECRET_KEY + AUTO_APPROVE=true + other env vars from local .env
- [x] Railway: create **frontend** service from same repo (set root directory), set VITE_API_URL to backend's generated Railway domain
- [x] DNS: add `findmyhygienist.org` (and `.com` redirect) as custom domain on frontend service, add CNAME at registrar per Railway's instructions
- [x] create sub-domains for dev and api so that csrf token pattern can be strict about "don't let cross domain talk" stuff in the code - deployed domains are now same, just like when you tested in local
- [x] Auto-deploy on push to main for both services
- [x] Smoke test: home page loads, register → profile → view public profile

<!-- This sprint exists because first deploys always surface
     surprises (missing env vars, CORS in production, path
     differences). Doing it now means Sprints 11–17 land on
     a live URL automatically, and Cris can see progress.

     Photo storage stays on local filesystem for now — S3
     swap is still in Sprint 17. Seed data and email aren't
     built yet. That's fine — the app works without them.

     ⚠️ Railway's filesystem is ephemeral — every push from
     Sprints 11–17 wipes uploaded photos. Only test data
     should be uploaded until S3 is wired in Sprint 17.

     See sprint-deploy-early.md for Nicole-facing step-by-step
     instructions with more detail than this task list. -->

---

## Sprint 9 — Frontend: Dashboard (Day 15) - DONE 4/2 10:32p

**Goal:** A provider can manage their profile from a dashboard. The read-write counterpart to Sprint 8's read-only profile page.

- [x] Dashboard — provider sees their own profile as it appears publicly, edit profile fields, manage locations, plus their status (PENDING/APPROVED/SUSPENDED)
- [x] LocationEntry inline edit mode — Sprint 6 only has toggle is_public and delete; providers can't edit address fields on existing locations without deleting and re-adding. Add edit mode now that Dashboard gets the full profile editor.
- [x] Extract useSaveState hook to shared hooks/ directory if Dashboard reuses IntakeProfile's per-section save pattern (currently local to IntakeProfile.tsx)
- [x] Component tests for Dashboard (smoke tests, extends Sprint 7 pattern)

<!-- Dashboard is the surface that makes providers feel in control of
     their listing. It needs to show what patients see AND let the
     provider change it. The big design question: does it reuse
     IntakeProfile's accordion layout or build a different editor? -->

---

## Sprint 8 — Frontend: Profile Page (Day 15) - DONE 4/2 4:12p

**Goal:** A provider can see how their profile looks publicly. This is the display half of the conference demo surface — the page providers will judge the product by at the conference.

- [x] PublicProfile and PublicLocation TypeScript types in types/provider.ts (frontend currently only has OwnProfile/OwnLocation — the public profile endpoint returns a different shape: no draft, no status, locations have label+city+state only)
- [x] apiGetPublicProfile wrapper in client.ts
- [x] Profile page — modeled after PsychologyToday's layout but shorter. Sections: hero (photo + name + credential chips + contact), bio, services/specialties/populations/insurance/tags, practice location(s) with labels, "report an issue" link at bottom
- [x] Tappable credential chips on profile page — tap/hover shows patient_description from Credential table
- [x] Photo rendering with default-avatar.svg fallback for providers who haven't uploaded one
- [x] Nav link spacing fix — Layout.tsx nav links have no gap/margin ("OralHealthProvidersFind a Provider..." runs together). Add flexbox gap or margin to nav links and the logout button.
- [x] Component tests for Profile page (smoke tests, extends Sprint 7 pattern)

<!-- This is where the design energy goes. Sprint 6 wired the data —
     this sprint makes it look like a product someone would trust with
     their professional listing. The profile page is the surface
     providers will judge the product by at the conference. -->

---

## Sprint 7 — Component Tests for Sprint 6 (Day 15) - DONE 4/2 1:28p

**Goal:** Test the intake flow components that Sprint 6 built. Extends the Vitest pattern from Sprint 3.

- [x] Smoke tests for IntakeProfile — renders accordion sections, per-section save triggers PATCH
- [x] CredentialSelector — renders grouped checkboxes, selection/deselection works
- [x] LocationEntry — add location, toggle is_public, delete
- [x] PhotoUpload — renders upload button, preview after upload, delete
- [x] Accordion — open/close toggle, default open vs closed
- [x] ListInput — add item, remove item, empty state
- [x] Join wizard — step transitions (Step 1 → Step 2 → Step 3), already-logged-in skip to Step 2

<!-- Sprint 6 shipped 6 new components and a 3-step wizard with no
     component tests. The API wrappers are tested (client-profile.test.ts,
     17 tests) but the components that USE them aren't. This sprint
     closes that gap before building more UI on top in Sprints 8-9. -->

---

## Sprint 6 — Frontend: API Client, Intake Form, Location Entry (Day 15) - DONE 4/2 10:48a

**Goal:** A provider can register, fill out their profile, upload a photo, and add practice locations. This is the data-entry half of the conference demo surface.

- [x] Verify /uploads/* photo URLs work through Vite proxy in dev — test before building any component that renders photos (see Housekeeping note)
- [x] Extend client.ts with typed API wrappers for: GET/PATCH profile, GET/PUT credentials, POST/DELETE photo (multipart — needs to skip the default Content-Type: application/json), GET/POST/PATCH/DELETE locations
- [x] Frontend: Join page expanded — full intake flow (account creation → credential selection → profile fields → location entry → photo upload → submission confirmation)
- [x] Frontend: Credential chip selector — checkboxes from GET /api/credentials, grouped by type (License, Degree, Permit, Specialty)
- [x] Frontend: Location entry — add/edit/remove practice locations. UX guided by ADR-013: traveling/mobile providers get "Where do you travel from?" with is_public unchecked and zip-only input; fixed-location providers get office address with is_public checked. Checkbox copy: "Show on my profile" (not "is_public"). See ADR-013 Frontend guidance section.
- [x] Placeholder profile photo for providers who haven't uploaded one (static asset / default avatar)

<!-- This sprint is about wiring the frontend to every /api/me/* endpoint
     that Sprints 4-5 built. The API client extensions are the foundation —
     every subsequent frontend sprint depends on them. The intake form is
     the surface providers will use at the conference booth. -->

---

## Sprint 5 — Photo Upload & Location CRUD (Day 11-14) - DONE 3/29-4/1 10:39a

**Goal:** Backend handles file uploads and multi-location provider records.

- [x] `POST /api/me/photo` — upload profile photo, store URL. Dev: local filesystem stub behind a storage interface. Prod S3 backend wired in Sprint 17 (bucket doesn't exist yet).
- [x] `DELETE /api/me/photo` — remove profile photo
- [x] Provider Location CRUD — add/edit/remove practice locations with label, practice_name, addresses. Lat/lng columns stay nullable — geocoding deferred to Sprint 11 when Nominatim implementation exists.

<!-- Different shape of work from Sprint 4: file validation, storage
     abstraction, and a multi-record sub-resource. Benefits from its
     own session. -->

---

## Sprint 4 — Profile API (Day 10) - DONE 3/28/2026 12:57p

**Goal:** Profile data flows through the API — read, write, and serve a complete provider profile with credentials.

- [x] `GET /api/credentials` — public list of all valid credential codes (powers intake form checkboxes + tappable chips)
- [x] `GET /api/me/profile` — own profile including draft and credentials
- [x] `PATCH /api/me/profile` — update own profile fields (bio, services, specialties, populations_served, insurance_accepted, tags, languages, contact prefs, max_travel_miles, etc.)
- [x] `PUT /api/me/credentials` — set credential codes (replaces full list via ProviderCredential join table)
- [x] `GET /api/providers/{slug}/{id}` — public profile endpoint (approved only), includes credentials with patient_description

<!-- All reading/writing columns on existing tables. One coherent unit:
     Pydantic schemas for the 25-field Provider model, credential join
     table operations, and the public-facing profile endpoint. -->

---

## Sprint 3 — Auth & Registration — Frontend (Day 9) - DONE 3/27/2026 9:31p

**Goal:** Wire the frontend to the auth backend. Provider can register, log in, log out, and see protected pages.

- [x] Removed provider_id from /api/auth/me response — auth layer shouldn't know about providers. Provider ID comes from /api/me/profile (Sprint 4).
- [x] Auth context/hook: call `GET /api/auth/me` on app load, store user state, expose login/logout/register functions
- [x] Frontend: Join page (registration form) — email, password, display_name, provider_type selector — calls `POST /api/auth/register`
- [x] Frontend: Login page — calls `POST /api/auth/login`
- [x] Frontend: include CSRF token on state-changing requests (POST/PUT/DELETE)
- [x] Frontend: route guards for authenticated pages (Dashboard) and admin pages (Admin)
- [x] Frontend: nav updates — show Login/Join when logged out, Dashboard/Logout when logged in, Admin link when role=ADMIN

---

## Sprint 2 — Auth & Registration — Backend (Days 3-8) - DONE 3/26/2026 9:52p

**Goal:** A provider can register, log in, and exist in the database with a status. Backend fully testable via Swagger / curl before frontend work begins.

- [x] Finalize auth approach (ADR-006) — session-based with server-side Postgres sessions
- [x] `sessions` table migration (id, user_id, created_at, expires_at) + model
- [x] Session service: create_session, get_session, delete_session (~50–60 lines)
- [x] Auth dependency: read session cookie → look up session → load User (replaces FastAPI's `OAuth2PasswordBearer` pattern)
- [x] CSRF middleware: synchronizer token pattern for state-changing requests (POST/PUT/DELETE) -> changed to use FastAPI Depends() dependency injection so the DB hit is only 1x, but same result and added OpenAPI perk (lock icon showing up on protected routes in Swagger).
- [x] add len(password) >= 8 requirement per NIST guidelines to code and fancier password rules ambitions to housekeeping, plus a pytest for this (+2)
- [x] `POST /api/auth/register` — create User (role=PROVIDER) + Provider (status=PENDING) in one transaction, auto-login (create session + set cookie)
- [x] `POST /api/auth/login` — verify argon2id hash, create session, set HTTP-only secure cookie
- [x] `POST /api/auth/logout` — delete session row, clear cookie
- [x] `GET /api/auth/me` — return current User (id, email, role) ~~+ linked Provider id~~ (revised in Sprint 3 — provider_id removed from /me response; belongs in /api/me/profile instead)
- [x] Auth middleware: protect `/api/me/*` and `/api/admin/*` routes
- [x] Admin check: `User.role == ADMIN` (ADR-009)
- [x] Create Nicole's admin User record (seed or CLI command)
- [x] CORS middleware on FastAPI (Vite proxy covers dev, but prod needs it — do it now so it doesn't bite us in Sprint 8)
- [x] `AUTO_APPROVE` env var support for conference mode (pulled forward from the admin sprint — register_provider reads settings.auto_approve to set status + auto_approved flag)

---

## Sprint 1 — Data Models & First Migration (Day 2) - DONE 3/20/2026 11:28a - 10:56p

**Goal:** All six tables exist in the database, credential seed data is loaded, Alembic is wired up and proven.

- [x] Enum definitions: `UserRole`, `CredentialType`, `ProviderType`, `ProviderStatus`, `Availability`, `FeedbackType`
- [x] SQLModel models: `User`, `Credential`, `Provider`, `ProviderCredential`, `ProviderLocation`, `Feedback`
- [x] `credentials.json` seed file (17 Oregon credential entries, ported from oral-health-providers)
- [x] Seed script or Alembic data migration to load credentials into Credential table
- [x] Uncomment model imports in `migrations/env.py`
- [x] Generate and apply first Alembic migration
- [x] Verify tables + seed data in Railway Postgres

---

## Sprint 0 — Repo & Infrastructure (Day 1) - DONE 3/19/2026 11:14a - 4:55p

**Goal:** `git init` to `npm run dev` + `uvicorn` both running, talking to each other, connected to a real database.

- [x] Initialize monorepo: `frontend/` (Vite + React + TypeScript) and `backend/` (FastAPI + SQLModel)
- [x] Vite proxy config: `/api/*` → `localhost:8000`
- [x] Backend: FastAPI app skeleton, config/env loading, database connection to Railway Postgres
- [x] Frontend: React Router v7 setup, page stubs (Home, Search, Profile, Join, Login, Dashboard, Admin, About)
- [x] Confirm frontend ↔ backend round-trip with a health-check endpoint
- [x] `.gitignore`, `.env.example`, basic README updates

**Commit 0:** Dependencies — `requirements.txt`, `package.json`. Nicole runs installs.

---
