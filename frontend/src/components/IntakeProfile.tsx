/**
 * IntakeProfile — Step 2 of the /join wizard (ADR-014).
 *
 * Loads the provider's profile on mount, then renders ProfileEditor
 * with intake-specific config: microcopy up top, Credentials and
 * Contact Preferences open by default, and a Done button at the bottom.
 *
 * Sprint 9 refactor: the 10 accordion sections and per-section save
 * logic moved to ProfileEditor so Dashboard can reuse them.
 * display_name is not editable here — it was set in Step 1.
 */

import { useEffect, useState } from "react";
import { apiGetOwnProfile } from "../api/client";
import type { OwnProfile } from "../types/provider";
import ProfileEditor from "./ProfileEditor";

// Sections that start open during intake (ADR-014)
const INTAKE_OPEN = new Set(["Credentials", "Contact Preferences"]);

interface IntakeProfileProps {
  onDone: () => void;
}

export default function IntakeProfile({ onDone }: IntakeProfileProps) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiGetOwnProfile()
      .then(setProfile)
      .catch((e) =>
        setLoadError(e instanceof Error ? e.message : "Failed to load profile")
      );
  }, []);

  if (loadError) return <p className="form-error">{loadError}</p>;
  if (!profile) return <p className="helper-text">Loading your profile…</p>;

  return (
    <div className="intake-profile">
      <div className="intake-microcopy">
        <p>
          <strong>You're findable!</strong> Patients can see your profile in
          search results. Add contact info below so they can reach you.
        </p>
      </div>

      <ProfileEditor
        profile={profile}
        defaultOpenSections={INTAKE_OPEN}
      />

      <div className="intake-done-row">
        <button type="button" onClick={onDone} className="btn btn-primary">
          Done — see my profile status
        </button>
        <small className="helper-text">
          You can always come back and edit from your dashboard.
        </small>
      </div>
    </div>
  );
}
