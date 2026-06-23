# Architecture

## What FindMyHygienist Does

FindMyHygienist is a provider directory. Two audiences use it in two different ways:

1. **Patients** (anonymous, no account needed) browse the directory — search by city/zip, filter by provider type or specialty, read profiles, find contact info.
2. **Providers** (authenticated) sign up, build a profile, upload a photo, and manage their listing over time.

There is one admin user (Nicole) who reviews and approves provider profiles before they go live, and reviews edits to already-live profiles.

---

## System Overview

```
┌─────────────┐        ┌──────────────┐        ┌────────────┐
│   React /   │  JSON   │   FastAPI    │  SQL    │  Railway   │
│  TypeScript │ ◄─────► │   Backend    │ ◄─────► │  Postgres  │
│   (Vite)    │  REST   │              │         │            │
└─────────────┘        └──────┬───────┘        └────────────┘
                              │
                              │ S3 API
                              ▼
                       ┌──────────────┐
                       │  DO Spaces / │
                       │ Cloudflare R2│
                       │ (images)     │
                       └──────────────┘
```

<!-- In dev, Vite proxies /api/* to FastAPI on :8000. In prod,
     frontend deploys to findmyhygienist.org and backend to
     api.findmyhygienist.org — both as separate Railway services
     with auto-deploy on push to main. The frontend reads
     VITE_API_URL at build time. Session cookies and CSRF tokens
     share the parent domain via cookie_domain='.findmyhygienist.org'
     (ADR-017). -->

---

## Data Model

<!-- Seven tables. User holds auth for everyone (providers and Nicole).
     Provider is the public-facing profile. Credential is a reference
     table seeded from Oregon licensing data. ProviderCredential is the
     join. ProviderLocation supports multi-site practitioners.
     Feedback is standalone. SearchLog records anonymous search analytics.
     See ADR-009 and ADR-010. -->

### User (auth identity — everyone)

<!-- Separates login credentials from the provider profile. Nicole's
     admin account is a User with role=ADMIN and no Provider record.
     A dental hygienist is a User with role=PROVIDER and a one-to-one
     Provider record. Future roles (facility manager, ODHA staff) get
     a new enum value, not a new table. -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `email` | str | Unique, login credential |
| `password_hash` | str | argon2id |
| `role` | enum | `PROVIDER`, `ADMIN` |
| `is_active` | bool | Default true; false = soft-deleted / locked out |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### Credential (reference table — seeded, not user-editable)

<!-- Oregon-specific oral health credentials. Seeded from credentials.json
     (ported from oral-health-providers project). The patientDescription
     powers the "tappable credential chips" feature from Focus Group #1:
     patients tap "EPDH" and see "Can provide care WITHOUT a dentist
     present — in schools, nursing homes, mobile clinics, or their own
     practice." Providers select from this list; they don't type codes
     freehand. -->

| Field | Type | Notes |
|-------|------|-------|
| `code` | str | PK, e.g. `"RDH"`, `"EPDH"`, `"LAP"` |
| `full_name` | str | e.g. "Expanded Practice Dental Hygienist" |
| `patient_description` | str | Plain-English explanation for patients |
| `credential_type` | enum | `LICENSE`, `DEGREE`, `PERMIT`, `SPECIALTY` |

Seed data (17 entries):

| Code | Type | Full Name |
|------|------|-----------|
| RDH | License | Registered Dental Hygienist |
| EPDH | License | Expanded Practice Dental Hygienist |
| DDS | License | Doctor of Dental Surgery |
| DMD | License | Doctor of Dental Medicine |
| EFDA | License | Expanded Function Dental Assistant |
| DT | License | Dental Therapist |
| ASDH | Degree | Associate of Science in Dental Hygiene |
| BSDH | Degree | Bachelor of Science in Dental Hygiene |
| LAP | Permit | Local Anesthesia Permit |
| NOP | Permit | Nitrous Oxide Permit |
| RFE | Permit | Restorative Functions Endorsement |
| PERIO | Specialty | Periodontist |
| ENDO | Specialty | Endodontist |
| ORTHO | Specialty | Orthodontist |
| OMS | Specialty | Oral & Maxillofacial Surgeon |
| PEDO | Specialty | Pediatric Dentist |
| PROS | Specialty | Prosthodontist |

### Provider (the public-facing profile)

<!-- One-to-one with User (user_id FK). All profile fields live here as
     columns — no separate "profile" table. The structured arrays
     (services, specialties, populations_served, insurance_accepted)
     power search filters. The freeform tags field lets providers
     express what makes them *them* beyond what structured fields capture
     ("LGBTQ-affirming", "anxiety-friendly", "CAMBRA", "trauma-informed").
     Credentials come from the join table, not a JSON column. -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → User, unique (one-to-one) |
| `display_name` | str | Full name as shown publicly |
| `slug` | str | URL-safe version of name, e.g. `ginger-davidson` |
| `provider_type` | enum | `DENTAL_HYGIENIST`, `DENTIST`, `DENTAL_THERAPIST`, `DENTAL_ASSISTANT`, `OTHER` |
| `title_line` | str | Freeform line under their name, e.g. "Registered Dental Hygienist, BSDH" |
| `bio` | text | Long-form personal statement |
| `mission_statement` | text | Optional — "why I do this work" |
| `photo_url` | str | Points to S3-compatible object storage |
| `phone` | str | Public contact phone (optional) |
| `public_email` | str | Public contact email (optional, separate from login email) |
| `website` | str | Optional |
| `languages` | list[str] | JSON array, e.g. `["English", "Spanish"]` |
| `services` | list[str] | Structured, e.g. `["cleanings", "sealants", "fluoride treatments", "perio maintenance"]` |
| `specialties` | list[str] | Structured, e.g. `["pediatric", "geriatric", "periodontal"]` |
| `populations_served` | list[str] | Structured, e.g. `["children", "seniors", "Spanish-speaking", "uninsured"]` |
| `insurance_accepted` | list[str] | e.g. `["OHP", "Delta Dental", "Cash/Sliding Scale"]` |
| `tags` | list[str] | Freeform self-expression, e.g. `["LGBTQ-affirming", "anxiety-friendly", "trauma-informed"]` |
| `availability` | enum | `IN_PERSON`, `MOBILE`, `BOTH` |
| `accepting_new_patients` | bool | |
| `max_travel_miles` | int | Nullable — relevant for mobile providers |
| `accepts_texts` | bool | Default false |
| `accepts_calls` | bool | Default true |
| `status` | enum | `PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `SUSPENDED` |
| `auto_approved` | bool | True if created during conference/fast-track mode |
| `reviewed_by` | UUID | FK → User, nullable (which admin reviewed) |
| `reviewed_at` | datetime | Nullable |
| `draft` | JSON | Pending edits to an approved profile; null when clean |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### ProviderCredential (join table)

<!-- Many-to-many between Provider and Credential. A provider selects
     from valid Oregon credentials; the frontend renders them as
     tappable chips using the Credential table's patient_description. -->

| Field | Type | Notes |
|-------|------|-------|
| `provider_id` | UUID | FK → Provider, composite PK |
| `credential_code` | str | FK → Credential.code, composite PK |

### ProviderLocation

<!-- Separate table: a provider might serve multiple locations (their
     own office + a community health clinic + a school-based program).
     Label tells patients *what kind* of place it is. Practice name is
     per-location because a hygienist might work at "Pacific Dental
     Services" on Tuesdays and "Salem Community Health Center" on
     Thursdays. -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `provider_id` | UUID | FK → Provider |
| `label` | str | e.g. "Main Office", "Mobile Area", "School-Based Program", "Home Base" |
| `practice_name` | str | Optional — e.g. "Pacific Dental Services" (may differ per location) |
| `address_line1` | str | |
| `address_line2` | str | Optional |
| `city` | str | Nullable, indexed — zip-only private locations may omit (ADR-013; geocoding backfills in Sprint 11) |
| `state` | str | Always "OR" for now, but don't hardcode (ADR-008) |
| `zip_code` | str | Indexed |
| `latitude` | float | For Haversine search |
| `longitude` | float | For Haversine search |
| `is_primary` | bool | Which location shows first |
| `is_public` | bool | Default true. False = search-only, invisible on public profile (ADR-013) |

### Feedback / Reports

<!-- Sprint 14 built POST /api/feedback and a dedicated Feedback page.
     Feedback goes to the database table — no email is sent. Nicole
     queries the table directly (Railway console) until the admin UI
     ships post-conference. -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `type` | enum | `REPORT_ISSUE`, `GENERAL_FEEDBACK` |
| `is_authenticated` | bool | Default false — true when a logged-in user submits |
| `submitted_by_user_id` | UUID | FK → User, nullable — set when authenticated, never forced |
| `provider_id` | UUID | FK → Provider, nullable (feedback may not target a specific provider) |
| `reporter_email` | str | Optional, typed into the form — not auto-filled from the user record |
| `message` | text | Max 10,000 chars (DB check constraint) |
| `created_at` | datetime | Server-side `func.now()` |
| `resolved` | bool | Default false |

### SearchLog (anonymous search analytics)

<!-- Fire-and-forget: the search endpoint inserts asynchronously and
     never blocks the response on a failed write. No PII — query_text
     is the raw location input (zip/address), not patient identity.
     Feeds ADR-016 batch tag suggestion pipeline and product analytics. -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `query_text` | text | Nullable — raw location input (zip, address, or blank for lat/lng) |
| `filters_applied` | JSONB | Nullable — which filters the search used (provider_type, credential, tag, etc.) |
| `result_provider_ids` | JSONB | Nullable — provider UUIDs returned |
| `result_count` | int | Dedicated column — cheaper than computing from JSONB length |
| `created_at` | datetime | Server-side `func.now()` |

---

## PII Considerations

<!-- No HIPAA here — there's no medical info about patients. But provider
     PII still matters. Here's the breakdown: -->

**Intentionally public (the whole point of the directory):** display_name, provider_type, credentials (via join table), bio, photo, phone, public_email, website, services, specialties, populations_served, insurance_accepted, tags, languages, practice locations, availability, contact preferences.

**Private (never exposed via public API):** User.email (login credential), User.password_hash, Provider.draft, admin review metadata (reviewed_by, reviewed_at), User.role.

**What to hash/encrypt:** Only `password_hash` (argon2id, handled by argon2-cffi — see ADR-011). Everything else is either intentionally public or simply access-controlled at the API layer (not returned in public endpoints). No field-level encryption needed — the provider is choosing to publish their info. Standard DB-level encryption at rest (Railway Postgres provides this) is sufficient.

---

## API Routes

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/providers` | Search/list providers. Query params: `lat`/`lng`/`radius`, `zip`, `address`, `provider_type`, `credential`, `accepting_new_patients`, `tag`, `insurance`, `page`, `per_page`. Approved only. Excludes `example-profile` tagged providers by default; `featured=true` returns only example providers (landing page showcase). |
| `GET` | `/api/providers/{slug}/{id}` | Full provider profile (approved only), includes credentials with patient descriptions |
| `GET` | `/api/providers/types` | Enum values for provider types |
| `GET` | `/api/providers/specialties` | *Deferred* — distinct specialty values for filter UI (post-conference, semantic search) |
| `GET` | `/api/credentials` | All valid credential codes with full_name, patient_description, type (powers intake form + tappable chips) |
| `POST` | `/api/feedback` | Submit feedback or report an issue |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Provider signup — creates User (role=PROVIDER) + Provider (status=PENDING) in one transaction |
| `POST` | `/api/auth/login` | Verify credentials, create session, set HTTP-only cookie |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Current User info (id, email, role)|

### Provider (authenticated, own profile)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me/profile` | Get own profile including draft and credentials |
| `PATCH` | `/api/me/profile` | Edit profile (lands in draft if already approved) |
| `PUT` | `/api/me/credentials` | Set credential codes (replaces full list) |
| `POST` | `/api/me/photo` | Upload profile photo |
| `DELETE` | `/api/me/photo` | Remove profile photo |
| `GET` | `/api/me/locations` | List own practice locations |
| `POST` | `/api/me/locations` | Add a practice location (max 10) |
| `PATCH` | `/api/me/locations/{location_id}` | Edit a practice location |
| `DELETE` | `/api/me/locations/{location_id}` | Remove a practice location |

### Admin (authenticated, role=ADMIN only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/queue` | Providers pending review (new signups + profiles with drafts) |
| `GET` | `/api/admin/providers` | All providers, any status |
| `POST` | `/api/admin/providers/{id}/approve` | Approve provider or approve draft edits |
| `POST` | `/api/admin/providers/{id}/request-changes` | Request changes (with message) |
| `POST` | `/api/admin/providers/{id}/suspend` | Suspend a listing |
| `GET` | `/api/admin/feedback` | View all feedback/reports |
| `POST` | `/api/admin/feedback/{id}/resolve` | Mark resolved |

---

## Frontend Pages

### Public

| Route | Page | Notes |
|-------|------|-------|
| `/` | Search | The landing page IS the search page (Sprint 13). No query → featured example providers as showcase. Active search → real results by zip/city/geolocation with radius and provider type filters. ProviderCard components with truncated bios above the fold. 'List with us' CTA. Educational triage stub text. |
| `/providers/:slug/:id` | Provider Profile | Full profile page. Bio, credentials, services, specialties, populations, locations with map, contact info. "Report an issue" link at bottom. |
| `/about` | About / Education | What FindMyHygienist is, what different provider types do, FAQ, educational triage content. Link to ODHA. |
| `/feedback` | Feedback | Submit feedback or report an issue. Writes to the `feedback` table — no email sent. Reached via 'Report an issue' on provider profiles (pre-fills provider_id and type) or 'Give us feedback' in the footer. |
| `/join` | Provider Signup | Intake form — account creation + initial profile all in one flow. |
| `/login` | Provider Login | |

### Authenticated (Provider)

| Route | Page | Notes |
|-------|------|-------|
| `/dashboard` | Provider Dashboard | View own profile as it appears publicly, edit profile, see status (pending/approved/changes requested). |

### Admin (Nicole only)

| Route | Page | Notes |
|-------|------|-------|
| `/admin` | Admin Dashboard | Review queue, provider list, feedback inbox. Single page with tabs, or very few pages — this doesn't need to be fancy, just functional. |

---

## Nearest-Provider Search (Haversine)

The search page answers "find providers near me" by city name, zip code, or lat/lng.

**Geocoding:** When a user searches by city or zip, the backend converts that to lat/lng via Nominatim (implemented Sprint 11, ADR-004 revised). Provider locations are geocoded on create/update; patient search queries are geocoded at request time.

**Distance query:** Sprint 12 implements Haversine in Python application code (ported from ORToothFairy's C# `SearchService`). At Oregon scale (hundreds of providers, not millions), loading approved providers into memory and filtering in Python is fast enough. The search respects both the user's search radius AND each provider's `max_travel_miles`. Example-profile providers are excluded by default; `featured=true` returns only example providers (powers the landing page showcase in Sprint 13).

**Search logging:** Every search is logged to `search_logs` (fire-and-forget — doesn't block the response). Feeds ADR-016's batch tag suggestion pipeline and general product analytics.

```sql
-- Haversine reference (the actual implementation is in Python, not SQL)
-- 3959 * acos(cos(radians(lat1)) * cos(radians(lat2))
--   * cos(radians(lng2) - radians(lng1))
--   + sin(radians(lat1)) * sin(radians(lat2)))
-- Returns distance in miles
```

---

## Image Upload Flow

1. Provider selects a photo in the frontend.
2. Frontend sends the file as `multipart/form-data` to `POST /api/me/photo`.
3. Backend validates (file type, file size — max 5MB, dimensions reasonable).
4. Backend uploads to S3-compatible storage via `boto3` (same SDK for DO Spaces and Cloudflare R2).
5. Backend stores the returned URL in `provider.photo_url`.
6. Frontend displays the image from the CDN URL.

<!-- Provider photos are public — no signed URLs needed.
     The S3 bucket has a public-read ACL on the photos prefix. -->

---

## Approval Flow

### New provider signup

```
Provider registers → status = PENDING → appears in admin queue
                                         │
              ┌────────────────┬──────────┴──────────┐
              ▼                ▼                      ▼
          APPROVED     CHANGES_REQUESTED          (ignored/
              │                │                   suspended)
              ▼                ▼
        Profile live    Provider sees message,
                        edits profile,
                        re-enters queue
```

### Existing provider edits their profile

```
Provider edits profile → changes land in `draft` column
                         (live profile unchanged)
                              │
                     appears in admin queue
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     Admin approves                  Admin requests changes
     draft → merged into             (provider notified,
     live fields, draft              draft stays, they
     set to null                     can revise)
```

### Conference mode

Set `AUTO_APPROVE=true` in environment. Registration flow skips the queue — status goes straight to `APPROVED`, `auto_approved` flag set to true for audit trail. Nicole can review these retroactively.

---

## Feedback & Issue Reporting

Two entry points, same backend endpoint (`POST /api/feedback`), same database table:

1. **"Report an issue"** — small gray link at bottom of each provider profile. Links to `/feedback?type=REPORT_ISSUE&provider_id=...` so the form pre-fills the provider context.
2. **"Give us feedback"** — link in the footer. General feedback, not tied to a specific provider.

Both write a row to the `feedback` table. No email is sent — Nicole reviews feedback by querying the table directly (Railway console) until the admin UI ships post-conference. The feedback endpoint is unauthenticated but captures `submitted_by_user_id` when a logged-in user submits, so admin review can distinguish anonymous visitors from providers.

