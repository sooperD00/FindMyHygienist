/**
 * Login page — email + password form.
 *
 * On success, updates the auth context and navigates to /dashboard.
 * Shows the backend's error message on failure (typically
 * "Invalid email or password" — intentionally vague per ADR-011
 * timing-attack note in auth_service.py).
 */

import { useState, type SyntheticEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow">
      <h1>Provider Log In</h1>

      <form onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}

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
          autoComplete="current-password"
        />

        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log In"}
        </button>
      </form>

      <p>
        New provider? <Link to="/join">Create an account</Link>
      </p>
    </div>
  );
}
