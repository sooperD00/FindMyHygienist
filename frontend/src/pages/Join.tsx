/**
 * Join page — provider registration form.
 *
 * Sprint 3 scope: account creation only (email, password, display_name,
 * provider_type). Sprint 5 expands this to the full intake flow with
 * credential selection, profile fields, and photo upload.
 *
 * On success, the backend auto-logs-in (sets session + CSRF cookies)
 * and returns the MeResponse. We update the auth context and navigate
 * to /dashboard.
 */

import { useState, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PROVIDER_TYPE_LABELS, type ProviderType } from "../types/auth";

const PROVIDER_TYPES = Object.entries(PROVIDER_TYPE_LABELS) as [
  ProviderType,
  string,
][];

export default function Join() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("DENTAL_HYGIENIST");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register({
        email,
        password,
        display_name: displayName,
        provider_type: providerType,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow">
      <h1>List With Us</h1>
      <p>Create your profile and connect with patients across Oregon.</p>
      <p>Free through July 2026.</p>

      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

        <label htmlFor="displayName">Full Name (as shown publicly)</label>
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
        {/* Sprint 3: just length. Fancier rules are in tech debt. */}
        <small>At least 8 characters</small>

        <label htmlFor="providerType">Provider Type</label>
        <select
          id="providerType"
          value={providerType}
          onChange={(e) => setProviderType(e.target.value as ProviderType)}
          required
        >
          {PROVIDER_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
