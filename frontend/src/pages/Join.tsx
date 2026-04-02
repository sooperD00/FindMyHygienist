/**
 * Join page — provider registration wizard (ADR-014).
 *
 * Three steps, URL stays /join, state-managed:
 *
 *   Step 1: Account creation + home base + defaults.
 *     POST /api/auth/register (auto-login)
 *     → POST /api/me/locations (home base, private, "Based in")
 *     → PATCH /api/me/profile (accepting_new_patients, max_travel_miles)
 *     One screen = findable.
 *
 *   Step 2: Profile fields (IntakeProfile component).
 *     10 accordion sections, per-section save. Skippable entirely.
 *
 *   Step 3: Confirmation. Fetches profile, shows status-based message.
 *     Frontend never reads backend config — just reacts to status.
 */

import { useState, useEffect, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  apiCreateLocation,
  apiUpdateProfile,
  apiGetOwnProfile,
} from "../api/client";
import { PROVIDER_TYPE_LABELS, type ProviderType } from "../types/auth";
import type { OwnProfile } from "../types/provider";
import IntakeProfile from "../components/IntakeProfile";

const PROVIDER_TYPES = Object.entries(PROVIDER_TYPE_LABELS) as [
  ProviderType,
  string,
][];

// Seven is fine. Dropdowns start feeling long around 15-20. This is a quick scan 
// where most providers will pick 25 (the default) and move on. The range makes 
// sense too — 5 miles is "my neighborhood," 100 miles is "I'll drive across the state."

// Can providers meaningfully distinguish between 5 and 10, or 75 and 100?
// const TRAVEL_MILE_OPTIONS = [5, 10, 15, 25, 50, 75, 100];
const TRAVEL_MILE_OPTIONS = [5, 10, 25, 50, 100];

/** 5-digit zip or zip+4 */
function isZipCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

// ── Step indicator ────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Account", "Profile", "Done"];
  return (
    <div className="wizard-steps" aria-label="Signup progress">
      {steps.map((label, i) => {
        const num = i + 1;
        const state =
          num < current ? "completed" : num === current ? "active" : "";
        return (
          <div key={num} className={`wizard-step ${state}`}>
            <span className="wizard-step-num">
              {num < current ? "✓" : num}
            </span>
            <span className="wizard-step-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Account creation ──────────────────────────────────────

//The three-call Step 1 error handling is intentionally asymmetric. 
// Registration failure blocks (you can't continue without an account). 
// Location and profile defaults are wrapped in a console.warn try/catch 
// — fail silently and let the provider fix it in Step 2.

function Step1({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerType, setProviderType] =
    useState<ProviderType>("DENTAL_HYGIENIST");
  const [homeBase, setHomeBase] = useState("");
  const [maxTravelMiles, setMaxTravelMiles] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // 1. Register — creates User + Provider, auto-login
      await register({
        email,
        password,
        display_name: displayName,
        provider_type: providerType,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed"
      );
      setSubmitting(false);
      return;
    }

    // Now logged in — create home base location and set defaults.
    // Non-fatal if these fail: user is registered and can fix in Step 2.
    try {
      const trimmed = homeBase.trim();
      if (trimmed) {
        const zip = isZipCode(trimmed);
        await apiCreateLocation({
          label: "Based in",
          city: zip ? undefined : trimmed,
          zip_code: zip ? trimmed : undefined,
          state: "OR",
          is_public: false,
          is_primary: true,
        });
      }
      await apiUpdateProfile({
        accepting_new_patients: true,
        max_travel_miles: maxTravelMiles,
      });
    } catch (err) {
      // Log but don't block — profile defaults are fixable in Step 2
      console.warn("Post-registration setup:", err);
    }

    setSubmitting(false);
    onComplete();
  }

  return (
    <div className="page-narrow">
      <h1>List With Us</h1>
      <p>Create your profile and connect with patients across Oregon.</p>
      <p>Free through July 2026.</p>

      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label htmlFor="displayName">Full name (as shown publicly)</label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoComplete="name"
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <small>At least 8 characters</small>

        <label htmlFor="providerType">Provider type</label>
        <select
          id="providerType"
          value={providerType}
          onChange={(e) =>
            setProviderType(e.target.value as ProviderType)
          }
          required
        >
          {PROVIDER_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="homeBase">Home base</label>
        <input
          id="homeBase"
          type="text"
          value={homeBase}
          onChange={(e) => setHomeBase(e.target.value)}
          placeholder="city or zip"
        />
        <small>
          Used for search radius — won't appear on your profile.
        </small>

        <label htmlFor="maxTravel">Maximum travel distance</label>
        <select
          id="maxTravel"
          value={maxTravelMiles}
          onChange={(e) => setMaxTravelMiles(Number(e.target.value))}
        >
          {TRAVEL_MILE_OPTIONS.map((mi) => (
            <option key={mi} value={mi}>
              {mi} miles
            </option>
          ))}
        </select>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

// ── Step 3: Confirmation ──────────────────────────────────────────

function Step3() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetOwnProfile()
      .then(setProfile)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load profile")
      );
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!profile) return <p className="helper-text">Loading…</p>;

  const isLive = profile.status === "APPROVED";

  return (
    <div className="page-narrow confirmation-step">
      {isLive ? (
        <>
          <h2>You're live!</h2>
          <p>
            Your profile is visible in the directory. Patients can find you
            in search results right now.
          </p>
          <Link
            to={`/providers/${profile.slug}/${profile.id}`}
            className="btn btn-primary"
          >
            View your public profile
          </Link>
        </>
      ) : (
        <>
          <h2>You're all set!</h2>
          <p>
            Your profile is pending review. We'll let you know when it's
            live. In the meantime, you can keep editing from your dashboard.
          </p>
        </>
      )}
      <Link to="/dashboard" className="btn btn-secondary">
        Go to your dashboard
      </Link>
    </div>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────

export default function Join() {
  const [step, setStep] = useState(1);
  const { user } = useAuth();

  // If already logged in, skip to Step 2
  // (handles page refresh during intake)
  useEffect(() => {
    if (user && step === 1) {
      setStep(2);
    }
  }, [user, step]);

  return (
    <div className="join-wizard">
      <StepIndicator current={step} />
      {step === 1 && <Step1 onComplete={() => setStep(2)} />}
      {step === 2 && (
        <div className="page-medium">
          <h1>Build Your Profile</h1>
          <IntakeProfile onDone={() => setStep(3)} />
        </div>
      )}
      {step === 3 && <Step3 />}
    </div>
  );
}
