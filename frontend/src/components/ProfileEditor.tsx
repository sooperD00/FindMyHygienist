/**
 * ProfileEditor — accordion-based profile field editor.
 *
 * Extracted from IntakeProfile in Sprint 9 so Dashboard can reuse
 * the same editing surface. The 10 accordion sections, per-section
 * save buttons, and all form state live here.
 *
 * Props:
 *   profile       — OwnProfile to initialize form state from
 *   onProfileUpdate — called after any successful save with the
 *                     updated profile (so the parent can refresh
 *                     its own copy for banners/summaries)
 *   defaultOpenSections — which accordion titles start open
 *                         (IntakeProfile: Credentials, Contact
 *                          Dashboard: none)
 *   showDisplayName — Dashboard shows it, IntakeProfile doesn't
 *                     (display_name is set at registration in Step 1)
 */

import { useState } from "react";
import {
  apiUpdateProfile,
  apiUpdateCredentials,
} from "../api/client";
import type { Availability, OwnProfile } from "../types/provider";
import Accordion from "./Accordion";
import CredentialSelector from "./CredentialSelector";
import ListInput from "./ListInput";
import LocationEntry from "./LocationEntry";
import PhotoUpload from "./PhotoUpload";
import SaveButton from "./SaveButton";
import { useSaveState } from "../hooks/useSaveState";

// ── Availability options ──────────────────────────────────────────

const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: "IN_PERSON", label: "In-person" },
  { value: "MOBILE", label: "Mobile / traveling" },
  { value: "BOTH", label: "Both" },
];

const TRAVEL_MILE_OPTIONS = [5, 10, 15, 25, 50, 75, 100];

// ── Props ─────────────────────────────────────────────────────────

interface ProfileEditorProps {
  profile: OwnProfile;
  onProfileUpdate?: (profile: OwnProfile) => void;
  defaultOpenSections?: Set<string>;
  showDisplayName?: boolean;
}

// ── Component ─────────────────────────────────────────────────────

export default function ProfileEditor({
  profile,
  onProfileUpdate,
  defaultOpenSections = new Set(),
  showDisplayName = false,
}: ProfileEditorProps) {
  // Merge draft on top of live fields so APPROVED providers see what
  // they actually saved, not stale live values. The draft column holds
  // pending edits as a flat JSON object with the same field names as
  // the live columns (e.g. { title_line: "...", bio: "..." }).
  // PENDING providers have no draft, so `merged` === `profile`.
  const draft = (profile.draft ?? {}) as Record<string, unknown>;
  const m = (key: string) => draft[key] ?? undefined; // draft field or undefined (fall through to live)

  // Per-field form state, initialized from draft (if present) then live
  const [displayName, setDisplayName] = useState(
    (m("display_name") as string | undefined) ?? profile.display_name ?? ""
  );
  const [titleLine, setTitleLine] = useState(
    (m("title_line") as string | undefined) ?? profile.title_line ?? ""
  );
  const [bio, setBio] = useState(
    (m("bio") as string | undefined) ?? profile.bio ?? ""
  );
  const [missionStatement, setMissionStatement] = useState(
    (m("mission_statement") as string | undefined) ?? profile.mission_statement ?? ""
  );
  const [phone, setPhone] = useState(
    (m("phone") as string | undefined) ?? profile.phone ?? ""
  );
  const [publicEmail, setPublicEmail] = useState(
    (m("public_email") as string | undefined) ?? profile.public_email ?? ""
  );
  const [website, setWebsite] = useState(
    (m("website") as string | undefined) ?? profile.website ?? ""
  );
  const [credentialCodes, setCredentialCodes] = useState<string[]>(
    profile.credentials.map((c) => c.code)
  );
  const [services, setServices] = useState<string[]>(
    (m("services") as string[] | undefined) ?? profile.services ?? []
  );
  const [specialties, setSpecialties] = useState<string[]>(
    (m("specialties") as string[] | undefined) ?? profile.specialties ?? []
  );
  const [populationsServed, setPopulationsServed] = useState<string[]>(
    (m("populations_served") as string[] | undefined) ?? profile.populations_served ?? []
  );
  const [insuranceAccepted, setInsuranceAccepted] = useState<string[]>(
    (m("insurance_accepted") as string[] | undefined) ?? profile.insurance_accepted ?? []
  );
  const [languages, setLanguages] = useState<string[]>(
    (m("languages") as string[] | undefined) ?? profile.languages ?? []
  );
  const [tags, setTags] = useState<string[]>(
    (m("tags") as string[] | undefined) ?? profile.tags ?? []
  );
  const [availability, setAvailability] = useState<Availability | null>(
    (m("availability") as Availability | undefined) ?? profile.availability
  );
  const [acceptingNew, setAcceptingNew] = useState(
    (m("accepting_new_patients") as boolean | undefined) ?? profile.accepting_new_patients
  );
  const [maxTravel, setMaxTravel] = useState<number | null>(
    (m("max_travel_miles") as number | undefined) ?? profile.max_travel_miles
  );
  const [acceptsTexts, setAcceptsTexts] = useState(
    (m("accepts_texts") as boolean | undefined) ?? profile.accepts_texts
  );
  const [acceptsCalls, setAcceptsCalls] = useState(
    (m("accepts_calls") as boolean | undefined) ?? profile.accepts_calls
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile.photo_url);

  // Per-section save states
  const displayNameSave = useSaveState();
  const bioSave = useSaveState();
  const contactSave = useSaveState();
  const credentialSave = useSaveState();
  const specialtiesSave = useSaveState();
  const insuranceSave = useSaveState();
  const languagesSave = useSaveState();
  const availabilitySave = useSaveState();
  const tagsSave = useSaveState();

  /** Save profile fields and notify parent. */
  async function saveFields(fields: Record<string, unknown>) {
    const updated = await apiUpdateProfile(
      fields as Parameters<typeof apiUpdateProfile>[0]
    );
    onProfileUpdate?.(updated);
  }

  return (
    <div className="profile-editor">
      {/* 0. Display name (Dashboard only) */}
      {showDisplayName && (
        <Accordion
          title="Display Name"
          defaultOpen={defaultOpenSections.has("Display Name")}
        >
          <label htmlFor="displayName">
            Your name as shown publicly
            <small className="helper-text">
              {" "}— this is how patients will see you in the directory
            </small>
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Ginger Davidson"
          />
          <SaveButton
            {...displayNameSave}
            onClick={() =>
              displayNameSave.run(() =>
                saveFields({ display_name: displayName || null })
              )
            }
          />
        </Accordion>
      )}

      {/* 1. Photo (closed) */}
      <Accordion
        title="Profile Photo"
        defaultOpen={defaultOpenSections.has("Profile Photo")}
      >
        <PhotoUpload currentUrl={photoUrl} onPhotoChange={setPhotoUrl} />
      </Accordion>

      {/* 2. Bio & title line (closed) */}
      <Accordion
        title="Bio & Title Line"
        defaultOpen={defaultOpenSections.has("Bio & Title Line")}
      >
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
              saveFields({
                title_line: titleLine || null,
                bio: bio || null,
                mission_statement: missionStatement || null,
              })
            )
          }
        />
      </Accordion>

      {/* 3. Credentials */}
      <Accordion
        title="Credentials"
        defaultOpen={defaultOpenSections.has("Credentials")}
      >
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

      {/* 4. Contact preferences */}
      <Accordion
        title="Contact Preferences"
        defaultOpen={defaultOpenSections.has("Contact Preferences")}
      >
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
              saveFields({
                phone: phone || null,
                public_email: publicEmail || null,
                website: website || null,
                accepts_calls: acceptsCalls,
                accepts_texts: acceptsTexts,
              })
            )
          }
        />
      </Accordion>

      {/* 5. Specialties, services & populations (closed) */}
      <Accordion
        title="Specialties, Services & Populations Served"
        defaultOpen={defaultOpenSections.has(
          "Specialties, Services & Populations Served"
        )}
      >
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
              saveFields({
                services: services.length > 0 ? services : null,
                specialties: specialties.length > 0 ? specialties : null,
                populations_served:
                  populationsServed.length > 0 ? populationsServed : null,
              })
            )
          }
        />
      </Accordion>

      {/* 6. Travel from & practice locations (closed) */}
      <Accordion
        title="Travel From & Practice Locations"
        defaultOpen={defaultOpenSections.has(
          "Travel From & Practice Locations"
        )}
      >
        <LocationEntry />
      </Accordion>

      {/* 7. Insurance accepted (closed) */}
      <Accordion
        title="Insurance Accepted"
        defaultOpen={defaultOpenSections.has("Insurance Accepted")}
      >
        <ListInput
          value={insuranceAccepted}
          onChange={setInsuranceAccepted}
          placeholder='e.g. OHP, Delta Dental, Cash/Sliding Scale'
        />
        <SaveButton
          {...insuranceSave}
          onClick={() =>
            insuranceSave.run(() =>
              saveFields({
                insurance_accepted:
                  insuranceAccepted.length > 0 ? insuranceAccepted : null,
              })
            )
          }
        />
      </Accordion>

      {/* 8. Languages (closed) */}
      <Accordion
        title="Languages"
        defaultOpen={defaultOpenSections.has("Languages")}
      >
        <ListInput
          value={languages}
          onChange={setLanguages}
          placeholder="e.g. English, Spanish, Vietnamese"
        />
        <SaveButton
          {...languagesSave}
          onClick={() =>
            languagesSave.run(() =>
              saveFields({
                languages: languages.length > 0 ? languages : null,
              })
            )
          }
        />
      </Accordion>

      {/* 9. Availability & scheduling (closed) */}
      <Accordion
        title="Availability & Scheduling"
        defaultOpen={defaultOpenSections.has("Availability & Scheduling")}
      >
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
              saveFields({
                availability,
                accepting_new_patients: acceptingNew,
                max_travel_miles: maxTravel,
              })
            )
          }
        />
      </Accordion>

      {/* 10. Tags & additional info (closed) */}
      <Accordion
        title="Tags & Additional Info"
        defaultOpen={defaultOpenSections.has("Tags & Additional Info")}
      >
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
              saveFields({
                tags: tags.length > 0 ? tags : null,
              })
            )
          }
        />
      </Accordion>
    </div>
  );
}
