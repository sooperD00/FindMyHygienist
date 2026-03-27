/**
 * Auth types — mirrors the Pydantic response models in routes/auth.py.
 *
 * ProviderType values must match the backend enum exactly
 * (they travel as strings in JSON).
 */

export interface UserResponse {
  id: string;
  email: string;
  role: "PROVIDER" | "ADMIN";
}

export interface MeResponse {
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  provider_type: ProviderType;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Must match backend's ProviderType enum values.
 * The labels are for the <select> dropdown in the Join form.
 */
export type ProviderType =
  | "DENTAL_HYGIENIST"
  | "DENTIST"
  | "DENTAL_THERAPIST"
  | "DENTAL_ASSISTANT"
  | "OTHER";

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  DENTAL_HYGIENIST: "Dental Hygienist",
  DENTIST: "Dentist",
  DENTAL_THERAPIST: "Dental Therapist",
  DENTAL_ASSISTANT: "Dental Assistant",
  OTHER: "Other",
};
