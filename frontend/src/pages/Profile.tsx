/**
 * Provider Profile — public-facing profile page.
 *
 * Route: /providers/:slug/:id
 *
 * This is the page providers will judge the product by at the
 * conference. It needs to look like a directory listing someone
 * would trust with their professional identity.
 *
 * Layout (single-column, mobile-first):
 *   1. Hero — photo, name, title, credential chips, contact
 *   2. Bio — personal statement + mission statement
 *   3. Details — services, specialties, populations, insurance, tags
 *   4. Locations — public practice locations with labels
 *   5. Footer — small "report an issue" link
 *
 * Data comes from GET /api/providers/{slug}/{id} (no auth needed).
 * The backend only returns APPROVED providers; 404 otherwise.
 * 
 * `cancelled` flag pattern: useEffect returns () => { cancelled = true }, 
 * which React calls if the component unmounts (user navigates away) or if 
 * slug/id change before the fetch completes. Without it, you'd call setProfile(data) 
 * on an unmounted component, crashing React <18, and applying stale data in React >=18.
 * The .then() callback captures the cancelled variable from its enclosing scope, 
 * so when it finally runs, it checks the current value.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiGetPublicProfile } from "../api/client";
import CredentialChip from "../components/CredentialChip";
import type { PublicProfile } from "../types/provider";
import defaultAvatar from "../assets/default-avatar.svg";

/* ── Helpers ─────────────────────────────────────────────────── */

// to avoid a nester ternary later, and in case you add another label later this is future proof
const AVAILABILITY_LABELS: Record<string, string> = {
  BOTH: "In-person & mobile",
  MOBILE: "Mobile",
  IN_PERSON: "In-person",
};

/** Format a phone number for display — keeps it simple, no masking. */
function formatPhone(phone: string): string {
  // If it's 10 digits, format as (xxx) xxx-xxxx
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone; // return as-is if not a standard 10-digit number
}

/** Render a list of string values as read-only chips, or null if empty. */

// Defined outside Profile so that React doesn't create a brand-new function component
// on every render (stable reference).

function DetailChips({
  label,
  items,
}: {
  label: string;
  items: string[] | null;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="profile-detail-group">
      <h3>{label}</h3>
      <div className="profile-chips">
        {items.map((item) => (
          <span key={item} className="profile-detail-chip">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────── */

function Profile() {
  const { slug, id } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGetPublicProfile(slug, id)
      .then((data) => {  // .then() callback
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) {
          // TypeScript intersection type, inline
          // "treat this as an Error that might also have a .status property"
          // pragmatic cast because catch gives you unknown in TypeScript (instead of undefined)
          const status = (err as Error & { status?: number }).status;
          if (status === 404) {
            setError("Provider not found.");
          } else {
            setError("Something went wrong loading this profile.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, id]);

  /* ── Loading / error states ────────────────────────────────── */

  if (loading) {
    return (
      <div className="page-profile">
        <p className="profile-loading">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page-profile">
        <div className="profile-error">
          <h1>Profile not found</h1>
          <p>{error ?? "This provider may not be listed yet."}</p>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  /* ── Derived values ────────────────────────────────────────── */

  const hasContact = profile.phone || profile.public_email || profile.website;
  // guard against rendering an empty <section> tag
  const hasDetails =
    (profile.services && profile.services.length > 0) ||
    (profile.specialties && profile.specialties.length > 0) ||
    (profile.populations_served && profile.populations_served.length > 0) ||
    (profile.insurance_accepted && profile.insurance_accepted.length > 0) ||
    (profile.tags && profile.tags.length > 0) ||
    (profile.languages && profile.languages.length > 0);
  const publicLocations = profile.locations; // backend already filters to is_public only

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="page-profile">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="profile-hero">
        <div className="profile-photo-col">
          <div className="profile-photo">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={`${profile.display_name}'s photo`}
                className="profile-photo-img"
              />
            ) : (
              <img
                src={defaultAvatar}
                alt=""
                className="profile-photo-placeholder"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        <div className="profile-hero-info">
          <h1 className="profile-name">{profile.display_name}</h1>

          {profile.title_line && (
            <p className="profile-title-line">{profile.title_line}</p>
          )}

          {profile.credentials.length > 0 && (
            <div className="profile-credentials">
              {profile.credentials.map((cred) => (
                <CredentialChip key={cred.code} credential={cred} />
              ))}
            </div>
          )}

          {/* Status badges */}
          <div className="profile-badges">
            {profile.accepting_new_patients && (
              <span className="profile-badge profile-badge-accepting">
                Accepting new patients
              </span>
            )}
            {profile.availability && (
              <span className="profile-badge">
                {/* ?? -> if BE adds a value not mapped you get the raw string instead of undefined */}
                {AVAILABILITY_LABELS[profile.availability] ?? profile.availability}
              </span>
            )}
          </div>

          {/* Contact info — inline in hero, not a sidebar */}
          {hasContact && (
            <div className="profile-contact">
              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="profile-contact-item"
                >
                  <span className="profile-contact-icon" aria-hidden="true">
                    ☎
                  </span>
                  {formatPhone(profile.phone)}
                </a>
              )}
              {profile.public_email && (
                <a
                  href={`mailto:${profile.public_email}`}
                  className="profile-contact-item"
                >
                  <span className="profile-contact-icon" aria-hidden="true">
                    ✉
                  </span>
                  {profile.public_email}
                </a>
              )}
              {profile.website && (
                <a
                  href={
                    profile.website.startsWith("http")
                      ? profile.website
                      : `https://${profile.website}`  // prepend https:// if its missing it so the link works
                  }
                  className="profile-contact-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="profile-contact-icon" aria-hidden="true" /* meaningful alt-text for real content only */>
                    🌐
                  </span>
                  {profile.website.replace(/^https?:\/\//, "") /* then the display text strips https:// so it looks nice */}
                </a>
              )}
              {profile.accepts_texts && profile.phone && (
                <span className="profile-contact-note">Accepts texts</span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Bio ─────────────────────────────────────────────── */}
      {(profile.bio || profile.mission_statement) && (
        <section className="profile-section">
          {profile.bio && (
            <div className="profile-bio">
              <h2>About</h2>
              {/* Render bio paragraphs — split on double newlines */}
              {profile.bio.split(/\n\n+/).map((para, i) => (
                // not great to use key={i} because reordering breaks it, but bio pps are static disply text
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
          {profile.mission_statement && (
            <blockquote className="profile-mission">
              {profile.mission_statement}
            </blockquote>
          )}
        </section>
      )}

      {/* ── Details (services, specialties, etc.) ───────────── */}
      {hasDetails && (
        <section className="profile-section">
          <DetailChips label="Services" items={profile.services} />
          <DetailChips label="Specialties" items={profile.specialties} />
          <DetailChips
            label="Populations Served"
            items={profile.populations_served}
          />
          <DetailChips
            label="Insurance Accepted"
            items={profile.insurance_accepted}
          />
          <DetailChips label="Languages" items={profile.languages} />
          <DetailChips label="Tags" items={profile.tags} />
        </section>
      )}

      {/* ── Locations ───────────────────────────────────────── */}
      {publicLocations.length > 0 && (
        <section className="profile-section">
          <h2>Practice Locations</h2>
          <div className="profile-locations">
            {publicLocations.map((loc) => (
              <div key={loc.id} className="profile-location-card">
                <div className="profile-location-label">
                  {loc.label}
                  {loc.is_primary && (
                    <span className="location-badge">Primary</span>
                  )}
                </div>
                {loc.practice_name && (
                  <div className="profile-location-practice">
                    {loc.practice_name}
                  </div>
                )}
                <div className="profile-location-city">
                  {[loc.city, loc.state].filter(Boolean).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer / report ─────────────────────────────────── */}
      <footer className="profile-footer">
        <Link
          to={`/feedback?type=REPORT_ISSUE&provider_id=${profile.id}&provider_name=${encodeURIComponent(profile.display_name)}`}
          className="profile-report-link"
        >
          Report an issue with this listing
        </Link>
      </footer>
    </div>
  );
}

export default Profile;
