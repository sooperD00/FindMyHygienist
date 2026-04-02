/**
 * IntakeProfile — Step 2 of the /join wizard (ADR-014).
 *
 * One page, 10 accordion sections. Profile fields loaded from
 * GET /api/me/profile on mount. Each section has its own Save
 * button that PATCHes just its fields. Credentials and Contact
 * Preferences open by default to signal importance.
 *
 * Photo, Credentials, and Locations handle their own saves
 * internally via their components.
 *
 * Accordion ordering (ADR-014):
 *   1. Photo (closed) — focus group asked for this first
 *   2. Bio & title line (closed)
 *   3. Credentials (OPEN)
 *   4. Contact preferences (OPEN)
 *   5. Specialties, services & populations (closed)
 *   6. Travel from & practice locations (closed)
 *   7. Insurance accepted (closed)
 *   8. Languages (closed)
 *   9. Availability & scheduling (closed)
 *  10. Tags & additional info (closed)
 */

import { useEffect, useState, useCallback } from "react";
import {
  apiGetOwnProfile,
  apiUpdateProfile,
  apiUpdateCredentials,
} from "../api/client";
import type { Availability, OwnProfile } from "../types/provider";
import Accordion from "./Accordion";
import CredentialSelector from "./CredentialSelector";
import ListInput from "./ListInput";
import LocationEntry from "./LocationEntry";
import PhotoUpload from "./PhotoUpload";

// ── Save button helper ────────────────────────────────────────────

function SaveButton({
  saving,
  saved,
  error,
  onClick,
}: {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onClick: () => void;
}) {
  return (
    <div className="section-save-row">
      <button
        type="button"
        onClick={onClick}
        disabled={saving}
        className="btn btn-small"
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      {error && <span className="form-error-inline">{error}</span>}
    </div>
  );
}

// ── Hook for save state ───────────────────────────────────────────

function useSaveState() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await fn();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, saved, error, run };
}

// ── Availability options ──────────────────────────────────────────

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: "IN_PERSON", label: "In-person" },
  { value: "MOBILE", label: "Mobile / traveling" },
  { value: "BOTH", label: "Both" },
];

const TRAVEL_MILE_OPTIONS = [5, 10, 15, 25, 50, 75, 100];

// ── Main component ────────────────────────────────────────────────

interface IntakeProfileProps {
  onDone: () => void;
}

export default function IntakeProfile({ onDone }: IntakeProfileProps) {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-section form state (initialized from profile)
  // manages accordion unmount here (not in the Accordion component itself)
  const [titleLine, setTitleLine] = useState("");
  const [bio, setBio] = useState("");
  const [missionStatement, setMissionStatement] = useState("");
  const [phone, setPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [credentialCodes, setCredentialCodes] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [populationsServed, setPopulationsServed] = useState<string[]>([]);
  const [insuranceAccepted, setInsuranceAccepted] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [acceptingNew, setAcceptingNew] = useState(true);
  const [maxTravel, setMaxTravel] = useState<number | null>(25);
  const [acceptsTexts, setAcceptsTexts] = useState(false);
  const [acceptsCalls, setAcceptsCalls] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Per-section save states
  const bioSave = useSaveState();
  const contactSave = useSaveState();
  const credentialSave = useSaveState();
  const specialtiesSave = useSaveState();
  const insuranceSave = useSaveState();
  const languagesSave = useSaveState();
  const availabilitySave = useSaveState();
  const tagsSave = useSaveState();

  // Load profile on mount
  useEffect(() => {
    apiGetOwnProfile()
      .then((p) => {
        setProfile(p);
        setTitleLine(p.title_line || "");
        setBio(p.bio || "");
        setMissionStatement(p.mission_statement || "");
        setPhone(p.phone || "");
        setPublicEmail(p.public_email || "");
        setWebsite(p.website || "");
        setCredentialCodes(p.credentials.map((c) => c.code));
        setServices(p.services || []);
        setSpecialties(p.specialties || []);
        setPopulationsServed(p.populations_served || []);
        setInsuranceAccepted(p.insurance_accepted || []);
        setLanguages(p.languages || []);
        setTags(p.tags || []);
        setAvailability(p.availability);
        setAcceptingNew(p.accepting_new_patients);
        setMaxTravel(p.max_travel_miles);
        setAcceptsTexts(p.accepts_texts);
        setAcceptsCalls(p.accepts_calls);
        setPhotoUrl(p.photo_url);
      })
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

      {/* 1. Photo (closed) */}
      <Accordion title="Profile Photo">
        <PhotoUpload currentUrl={photoUrl} onPhotoChange={setPhotoUrl} />
      </Accordion>

      {/* 2. Bio & title line (closed) */}
      <Accordion title="Bio & Title Line">
        <label htmlFor="titleLine">
          Title line
          <small className="helper-text">
            Shown under your name, e.g. "Registered Dental Hygienist, BSDH"
          </small>
        </label>
        <input
          id="titleLine"
          type="text"
          value={titleLine}
          onChange={(e) => setTitleLine(e.target.value)}
          placeholder="e.g. Registered Dental Hygienist, BSDH"
        />

        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          placeholder="Tell patients about yourself — your approach, experience, what makes you you."
        />

        <label htmlFor="missionStatement">
          Mission statement{" "}
          <small className="helper-text">(optional)</small>
        </label>
        <textarea
          id="missionStatement"
          value={missionStatement}
          onChange={(e) => setMissionStatement(e.target.value)}
          rows={3}
          placeholder="Why I do this work…"
        />

        <SaveButton
          {...bioSave}
          onClick={() =>
            bioSave.run(() =>
              apiUpdateProfile({
                title_line: titleLine || null,
                bio: bio || null,
                mission_statement: missionStatement || null,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 3. Credentials (OPEN) */}
      <Accordion title="Credentials" defaultOpen>
        <CredentialSelector
          selected={credentialCodes}
          onChange={setCredentialCodes}
        />
        <SaveButton
          {...credentialSave}
          onClick={() =>
            credentialSave.run(() =>
              apiUpdateCredentials(credentialCodes).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 4. Contact preferences (OPEN) */}
      <Accordion title="Contact Preferences" defaultOpen>
        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(503) 555-0100"
        />

        <label htmlFor="publicEmail">Public email</label>
        <input
          id="publicEmail"
          type="email"
          value={publicEmail}
          onChange={(e) => setPublicEmail(e.target.value)}
          placeholder="your-practice@email.com"
        />
        <small className="helper-text">
          Separate from your login email — this one is visible to patients.
        </small>

        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://your-practice.com"
        />

        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={acceptsCalls}
              onChange={(e) => setAcceptsCalls(e.target.checked)}
            />
            Accepts phone calls
          </label>
          <label>
            <input
              type="checkbox"
              checked={acceptsTexts}
              onChange={(e) => setAcceptsTexts(e.target.checked)}
            />
            Accepts text messages
          </label>
        </div>

        <SaveButton
          {...contactSave}
          onClick={() =>
            contactSave.run(() =>
              apiUpdateProfile({
                phone: phone || null,
                public_email: publicEmail || null,
                website: website || null,
                accepts_calls: acceptsCalls,
                accepts_texts: acceptsTexts,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 5. Specialties, services & populations (closed) */}
      <Accordion title="Specialties, Services & Populations Served">
        <label>Services</label>
        <ListInput
          value={services}
          onChange={setServices}
          placeholder="e.g. cleanings, sealants, fluoride treatments"
        />

        <label>Specialties</label>
        <ListInput
          value={specialties}
          onChange={setSpecialties}
          placeholder="e.g. pediatric, geriatric, periodontal"
        />

        <label>Populations served</label>
        <ListInput
          value={populationsServed}
          onChange={setPopulationsServed}
          placeholder="e.g. children, seniors, Spanish-speaking, uninsured"
        />

        <SaveButton
          {...specialtiesSave}
          onClick={() =>
            specialtiesSave.run(() =>
              apiUpdateProfile({
                services: services.length > 0 ? services : null,
                specialties: specialties.length > 0 ? specialties : null,
                populations_served:
                  populationsServed.length > 0 ? populationsServed : null,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 6. Travel from & practice locations (closed) */}
      <Accordion title="Travel From & Practice Locations">
        <LocationEntry />
      </Accordion>

      {/* 7. Insurance accepted (closed) */}
      <Accordion title="Insurance Accepted">
        <ListInput
          value={insuranceAccepted}
          onChange={setInsuranceAccepted}
          placeholder='e.g. OHP, Delta Dental, Cash/Sliding Scale'
        />
        <SaveButton
          {...insuranceSave}
          onClick={() =>
            insuranceSave.run(() =>
              apiUpdateProfile({
                insurance_accepted:
                  insuranceAccepted.length > 0 ? insuranceAccepted : null,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 8. Languages (closed) */}
      <Accordion title="Languages">
        <ListInput
          value={languages}
          onChange={setLanguages}
          placeholder="e.g. English, Spanish, Vietnamese"
        />
        <SaveButton
          {...languagesSave}
          onClick={() =>
            languagesSave.run(() =>
              apiUpdateProfile({
                languages: languages.length > 0 ? languages : null,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 9. Availability & scheduling (closed) */}
      <Accordion title="Availability & Scheduling">
        <label htmlFor="availability">How do you see patients?</label>
        <select
          id="availability"
          value={availability || ""}
          onChange={(e) =>
            setAvailability((e.target.value as Availability) || null)
          }
        >
          <option value="">Select…</option>
          {AVAILABILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label>
          <input
            type="checkbox"
            checked={acceptingNew}
            onChange={(e) => setAcceptingNew(e.target.checked)}
          />
          Accepting new patients
        </label>

        <label htmlFor="maxTravel">Maximum travel distance</label>
        <select
          id="maxTravel"
          value={maxTravel ?? ""}
          onChange={(e) =>
            setMaxTravel(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">Not applicable</option>
          {TRAVEL_MILE_OPTIONS.map((mi) => (
            <option key={mi} value={mi}>
              {mi} miles
            </option>
          ))}
        </select>

        <SaveButton
          {...availabilitySave}
          onClick={() =>
            availabilitySave.run(() =>
              apiUpdateProfile({
                availability,
                accepting_new_patients: acceptingNew,
                max_travel_miles: maxTravel,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* 10. Tags & additional info (closed) */}
      <Accordion title="Tags & Additional Info">
        <small className="helper-text">
          Freeform tags that describe what makes you <em>you</em> beyond
          structured fields.
        </small>
        <ListInput
          value={tags}
          onChange={setTags}
          placeholder='e.g. LGBTQ-affirming, anxiety-friendly, trauma-informed'
        />
        <SaveButton
          {...tagsSave}
          onClick={() =>
            tagsSave.run(() =>
              apiUpdateProfile({
                tags: tags.length > 0 ? tags : null,
              }).then(() => {})
            )
          }
        />
      </Accordion>

      {/* Done button */}
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
