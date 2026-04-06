/**
 * Provider types — mirrors backend Pydantic response models from
 * routes/profile.py, routes/locations.py, routes/photo.py.
 *
 * Split from auth.ts because these types are used by profile,
 * location, credential, and photo endpoints — not auth.
 */

// ── Enums (string unions matching backend) ────────────────────────
//    additional contracts for TS compile-time safety

export type CredentialType = "LICENSE" | "DEGREE" | "PERMIT" | "SPECIALTY";  

export type Availability = "IN_PERSON" | "MOBILE" | "BOTH";

export type ProviderStatus =
  | "PENDING"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "SUSPENDED";

// ── Credential ────────────────────────────────────────────────────

export interface Credential {
  code: string;
  full_name: string;
  patient_description: string;
  credential_type: CredentialType;
}

// ── Locations ─────────────────────────────────────────────────────

export interface OwnLocation {
  id: string;
  label: string;
  practice_name: string | null;  // this is a Read (GET) so "ok to return null" is OK, but not ? (missing)
  address_line1: string | null;  // you want everything returned
  address_line2: string | null;
  city: string | null;
  state: string;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  is_public: boolean;
}

export interface LocationCreate {
  label: string;
  practice_name?: string | null;  // this is a POST, and BE will null/None for us, so ? (missing) is OK
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string;
  zip_code?: string | null;
  is_primary?: boolean;
  is_public?: boolean;
}

export interface LocationUpdate {
  label?: string;
  practice_name?: string | null;  // this is a PATCH, so ? (missing) is OK
  address_line1?: string | null;  // PATCH — missing means "don't touch," null means "clear it."
  address_line2?: string | null;  // BE uses exclude_unset to tell them apart.
  city?: string | null;
  state?: string;
  zip_code?: string | null;
  is_primary?: boolean;
  is_public?: boolean;
}

// ── Profile ───────────────────────────────────────────────────────

export interface OwnProfile {
  id: string;
  display_name: string;
  slug: string;
  provider_type: string;
  title_line: string | null;
  bio: string | null;
  mission_statement: string | null;
  photo_url: string | null;
  phone: string | null;
  public_email: string | null;
  website: string | null;
  languages: string[] | null;
  services: string[] | null;
  specialties: string[] | null;
  populations_served: string[] | null;
  insurance_accepted: string[] | null;
  tags: string[] | null;
  availability: Availability | null;
  accepting_new_patients: boolean;
  max_travel_miles: number | null;
  accepts_texts: boolean;
  accepts_calls: boolean;
  status: ProviderStatus;
  draft: Record<string, unknown> | null;
  reviewed_at: string | null;
  credentials: Credential[];
  locations: OwnLocation[];
  created_at: string | null;
  updated_at: string | null;
}

export interface ProfileUpdate {
  display_name?: string;
  provider_type?: string;
  title_line?: string | null;
  bio?: string | null;
  mission_statement?: string | null;
  phone?: string | null;
  public_email?: string | null;
  website?: string | null;
  languages?: string[] | null;
  services?: string[] | null;
  specialties?: string[] | null;
  populations_served?: string[] | null;
  insurance_accepted?: string[] | null;
  tags?: string[] | null;
  availability?: Availability | null;
  accepting_new_patients?: boolean;
  max_travel_miles?: number | null;
  accepts_texts?: boolean;
  accepts_calls?: boolean;
}

// ── Photo ─────────────────────────────────────────────────────────

export interface PhotoResponse {
  photo_url: string | null;
}

// ── Search result types ──────────────────────────────────────────
//    These mirror SearchResponse / ProviderSearchResult from
//    routes/search.py. Different shape from PublicProfile — includes
//    distance metadata, flattened credentials (codes only, not full
//    objects), and no locations array.

export interface ProviderSearchResult {
  id: string;
  slug: string;
  display_name: string;
  provider_type: string;
  title_line: string | null;
  bio: string | null;
  mission_statement: string | null;
  photo_url: string | null;
  phone: string | null;
  public_email: string | null;
  website: string | null;
  credentials: string[];            // code strings, not full Credential objects
  accepting_new_patients: boolean;
  availability: string | null;
  tags: string[];
  insurance_accepted: string[] | null;
  services: string[] | null;
  specialties: string[] | null;
  populations_served: string[] | null;
  languages: string[] | null;
  distance_miles: number;
  nearest_location_city: string | null;
  nearest_location_state: string | null;
}

export interface SearchResponse {
  results: ProviderSearchResult[];
  count: number;
  page: number;
  per_page: number;
  total_count: number;
  search_location: string | null;
}

export interface ProviderTypeOption {
  code: string;
  label: string;
}

export interface SearchParams {
  latitude?: number;
  longitude?: number;
  zipCode?: string;
  address?: string;
  radiusMiles?: number;
  providerType?: string;
  credential?: string;
  acceptingNewPatients?: boolean;
  insurance?: string;
  page?: number;
  perPage?: number;
}

// ── Public-facing types (no auth needed) ─────────────────────────
//    These mirror PublicProfileResponse / PublicLocationResponse
//    from routes/profile.py and routes/locations.py. The public
//    endpoint strips draft, status, admin metadata, and full
//    address details from locations.

export interface PublicLocation {
  id: string;
  label: string;
  practice_name: string | null;
  city: string | null;
  state: string;
  is_primary: boolean;
}

export interface PublicProfile {
  id: string;
  display_name: string;
  slug: string;
  provider_type: string;
  title_line: string | null;
  bio: string | null;
  mission_statement: string | null;
  photo_url: string | null;
  phone: string | null;
  public_email: string | null;
  website: string | null;
  languages: string[] | null;
  services: string[] | null;
  specialties: string[] | null;
  populations_served: string[] | null;
  insurance_accepted: string[] | null;
  tags: string[] | null;
  availability: Availability | null;
  accepting_new_patients: boolean;
  max_travel_miles: number | null;
  accepts_texts: boolean;
  accepts_calls: boolean;
  credentials: Credential[];
  locations: PublicLocation[];
}
