/**
 * Provider Dashboard — manage your listing.
 *
 * Sprint 9 rewrite. Three sections:
 *   1. Status banner — PENDING / APPROVED / SUSPENDED, with a link
 *      to the public profile page when approved.
 *   2. Compact summary — photo, name, credential codes. Quick
 *      at-a-glance "this is what's live" without duplicating the
 *      full Profile page rendering.
 *   3. ProfileEditor — the same 10 accordion sections from the
 *      intake form, all closed by default (maintenance mode).
 *      Plus a Display Name section (not in intake because Step 1
 *      handles it during registration).
 *
 * Route: /dashboard (wrapped in ProtectedRoute in App.tsx)
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiGetOwnProfile } from "../api/client";
import type { OwnProfile, ProviderStatus } from "../types/provider";
import ProfileEditor from "../components/ProfileEditor";
import defaultAvatar from "../assets/default-avatar.svg";

// ── Status banner config ─────────────────────────────────────────

const STATUS_CONFIG: Record<
  ProviderStatus,
  { className: string; heading: string; message: string }
> = {
  PENDING: {
    className: "dashboard-status-pending",
    heading: "Profile under review",
    message:
      "Your profile has been submitted and is waiting for approval. You can continue editing below — changes are saved immediately.",
  },
  APPROVED: {
    className: "dashboard-status-approved",
    heading: "Your profile is live!",
    message:
      "Patients can find you in the directory. Any changes you make below are saved immediately.",
  },
  CHANGES_REQUESTED: {
    className: "dashboard-status-changes",
    heading: "Changes requested",
    message:
      "The admin has requested changes to your profile. Please review and update the fields below.",
  },
  SUSPENDED: {
    className: "dashboard-status-suspended",
    heading: "Listing suspended",
    message:
      "Your listing has been temporarily suspended and is not visible in the directory. If you believe this is an error, please contact us.",
  },
};

// ── Component ────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== "PROVIDER") return;

    let cancelled = false;
    apiGetOwnProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Failed to load profile"
          );
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Admin users don't have a provider profile
  if (user?.role === "ADMIN") {
    return (
      <div className="page-medium">
        <h1>Dashboard</h1>
        <p>
          You're logged in as an admin.{" "}
          <Link to="/admin">Go to Admin Dashboard →</Link>
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-medium">
        <h1>My Dashboard</h1>
        <p className="form-error">{loadError}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page-medium">
        <h1>My Dashboard</h1>
        <p className="helper-text">Loading your profile…</p>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[profile.status];
  const credentialCodes = profile.credentials.map((c) => c.code).join(", ");

  return (
    <div className="page-medium">
      <h1>My Dashboard</h1>

      {/* ── Status banner ──────────────────────────────────── */}
      <div className={`dashboard-status ${statusInfo.className}`}>
        <strong>{statusInfo.heading}</strong>
        <p>{statusInfo.message}</p>
        {profile.status === "APPROVED" && (
          <Link
            to={`/providers/${profile.slug}/${profile.id}`}
            className="dashboard-profile-link"
          >
            View my public profile →
          </Link>
        )}
      </div>

      {/* ── Compact summary ────────────────────────────────── */}
      <div className="dashboard-summary">
        <div className="dashboard-summary-photo">
          {profile.photo_url ? (
            <img
              src={profile.photo_url}
              alt={`${profile.display_name}'s photo`}
              className="dashboard-summary-img"
            />
          ) : (
            <img
              src={defaultAvatar}
              alt=""
              className="dashboard-summary-placeholder"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="dashboard-summary-info">
          <strong className="dashboard-summary-name">
            {profile.display_name}
          </strong>
          {profile.title_line && (
            <span className="dashboard-summary-title">
              {profile.title_line}
            </span>
          )}
          {credentialCodes && (
            <span className="dashboard-summary-credentials">
              {credentialCodes}
            </span>
          )}
        </div>
      </div>

      {/* ── Profile editor (all sections closed by default) ── */}
      <h2>Edit your profile</h2>
      <ProfileEditor
        profile={profile}
        onProfileUpdate={setProfile}
        showDisplayName
      />
    </div>
  );
}
