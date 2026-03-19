# Architecture

## What OHP Does

OHP is a provider directory. Two audiences use it in two different ways:

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

<!-- In dev, Vite proxies /api/* to FastAPI on :8000. In prod, both
     services deploy separately and the frontend fetches from the
     API's public URL (configured via env var). -->

---

## Data Model

### Provider (the core table)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `email` | str | Login credential, not necessarily public-facing |
| `password_hash` | str | bcrypt |
| `status` | enum | `PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `SUSPENDED` |
| `auto_approved` | bool | True if created during conference/fast-track mode |
| `reviewed_by` | str | Admin identifier, nullable |
| `reviewed_at` | datetime | Nullable |
| `draft` | JSON | Pending edits to an approved profile; null when clean |
| `created_at` | datetime | |
| `updated_at` | datetime | |

### Provider Profile Fields

<!-- These live as columns on the provider table for now. If the profile
     gets complex enough to warrant a separate table, that's ADR material. -->

| Field | Type | Notes |
|-------|------|-------|
| `display_name` | str | Full name as shown publicly |
| `slug` | str | URL-safe version of name, e.g. `ginger-davidson` |
| `provider_type` | enum | `DENTAL_HYGIENIST`, `DENTIST`, `DENTAL_THERAPIST`, etc. |
| `credentials` | list[str] | Self-reported, e.g. `["RDH", "BSDH"]` — stored as JSON array |
| `title_line` | str | Freeform line under their name, e.g. "Registered Dental Hygienist, BSDH" |
| `bio` | text | Long-form personal statement |
| `mission_statement` | text | Optional — "why I do this work" |
| `photo_url` | str | Points to S3-compatible object storage |
| `phone` | str | Public contact phone (optional) |
| `public_email` | str | Public contact email (optional, separate from login email) |
| `website` | str | Optional |
| `languages` | list[str] | JSON array |
| `services` | list[str] | e.g. `["cleanings", "sealants", "fluoride treatments", "perio maintenance"]` |
| `specialties` | list[str] | e.g. `["pediatric", "geriatric", "periodontal"]` |
| `populations_served` | list[str] | e.g. `["children", "seniors", "Spanish-speaking", "uninsured"]` |
| `availability` | enum | `IN_PERSON`, `MOBILE`, `BOTH` |
| `accepting_new_patients` | bool | |

### Provider Location

<!-- Separate table because a provider might serve multiple locations
     (their own office + a community health clinic, etc.) -->

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `provider_id` | UUID | FK → Provider |
| `address_line1` | str | |
| `address_line2` | str | Optional |
| `city` | str | Indexed |
| `state` | str | Always "OR" for now, but don't hardcode |
| `zip_code` | str | Indexed |
| `latitude` | float | For Haversine search |
| `longitude` | float | For Haversine search |
| `is_primary` | bool | Which location shows first |

### Feedback / Reports

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `type` | enum | `REPORT_ISSUE`, `GENERAL_FEEDBACK` |
| `provider_id` | UUID | FK → Provider, nullable (feedback may not target a specific provider) |
| `reporter_email` | str | Optional, if they want a reply |
| `message` | text | |
| `created_at` | datetime | |
| `resolved` | bool | Default false |

---

## PII Considerations

<!-- No HIPAA here — there's no medical info about patients. But provider
     PII still matters. Here's the breakdown: -->

**Intentionally public (the whole point of the directory):** display_name, provider_type, credentials, bio, photo, phone, public_email, website, services, specialties, practice addresses.

**Private (never exposed via public API):** login email (if different from public_email), password_hash, draft edits, admin review metadata.

**What to hash/encrypt:** Only `password_hash` (bcrypt, handled by the auth library). Everything else is either intentionally public or simply access-controlled at the API layer (not returned in public endpoints). No field-level encryption needed — the provider is choosing to publish their info. Standard DB-level encryption at rest (Railway Postgres provides this) is sufficient.

---

## API Routes

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/providers` | Search/list providers. Query params: `city`, `zip`, `lat`/`lng`/`radius`, `provider_type`, `specialty`, `keyword`, `page`, `per_page` |
| `GET` | `/api/providers/{slug}/{id}` | Full provider profile (approved only) |
| `GET` | `/api/providers/types` | Enum values for provider types |
| `GET` | `/api/providers/specialties` | Distinct specialty values (for filter UI) |
| `POST` | `/api/feedback` | Submit feedback or report an issue |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Provider signup (creates account + profile in PENDING status) |
| `POST` | `/api/auth/login` | Returns session token or JWT |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Current user info |

### Provider (authenticated, own profile)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me/profile` | Get own profile including draft |
| `PUT` | `/api/me/profile` | Edit profile (lands in draft if already approved) |
| `POST` | `/api/me/photo` | Upload profile photo |
| `DELETE` | `/api/me/photo` | Remove profile photo |

### Admin (authenticated, admin only)

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
| `/` | Landing / Search | Could be a landing page with search bar that redirects to `/providers/or/:city`, or could go straight to the search page. Decide in sprint. |
| `/providers/or/:city` | Search Results | Modeled after PsychologyToday's city search. 3 truncated bios above the fold, photo + name + credentials + truncated bio + contact. Filters at top. Keyword search. "List with us" CTA. Educational triage stub text. |
| `/providers/:slug/:id` | Provider Profile | Full profile page. Bio, credentials, services, specialties, populations, locations with map, contact info. "Report an issue" link at bottom. |
| `/about` | About / Education | What OHP is, what different provider types do, FAQ, educational triage content. |
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

The search page needs to answer "find providers near me" by city name, zip code, or lat/lng.

**Geocoding:** When a user searches by city or zip, the backend needs to convert that to lat/lng. Options:

1. **Static lookup table** — preload Oregon cities/zips with their centroids. ~400 cities, ~500 zips. No external API call needed. Good enough for MVP.
2. **Geocoding API** (Google, Mapbox, Nominatim) — more accurate, handles partial input, but adds a dependency and possibly cost.

Recommendation: static lookup for MVP, geocoding API later if needed.

**Distance query:** Postgres can do Haversine math in SQL. For the scale of Oregon providers (hundreds, not millions), a simple `WHERE` clause with the Haversine formula is fast enough — no PostGIS or spatial index needed. If it ever gets slow, add a bounding-box pre-filter.

```sql
-- Haversine in Postgres (returns miles)
SELECT p.*, (
    3959 * acos(
        cos(radians(:lat)) * cos(radians(pl.latitude))
        * cos(radians(pl.longitude) - radians(:lng))
        + sin(radians(:lat)) * sin(radians(pl.latitude))
    )
) AS distance
FROM providers p
JOIN provider_locations pl ON p.id = pl.provider_id
WHERE p.status = 'APPROVED'
ORDER BY distance
LIMIT 20;
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

Two entry points, same backend:

1. **"Report an issue"** — small gray link at bottom of each provider profile. Sends email to Nicole and creates a `Feedback` row with `type=REPORT_ISSUE` and the `provider_id`.
2. **"Give us feedback"** — link in nav or footer. General feedback, not tied to a specific provider.

MVP email delivery: use a transactional email service (Resend, Mailgun, or even just SMTP to Gmail). The email is a notification to Nicole; the canonical record is the database row.
