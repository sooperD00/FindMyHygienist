/**
 * ProviderCard — search result card for the directory listing.
 *
 * Layout modeled on PsychologyToday's provider cards:
 *   [Photo] | [Name, credentials, location, truncated bio] | [Phone, Email, View]
 *
 * Used in both the landing page (featured providers) and active
 * search results. The card is a self-contained read-only display;
 * the "View" link navigates to the full profile page.
 *
 * Receives a ProviderSearchResult (flat, with distance metadata)
 * rather than a PublicProfile (nested credentials/locations).
 */

import { Link } from "react-router-dom";
import type { ProviderSearchResult } from "../types/provider";
import defaultAvatar from "../assets/default-avatar.svg"; // assumes the import asset exists; if missing, build error at runtime = good failure mode

const AVAILABILITY_LABELS: Record<string, string> = {
  BOTH: "In-person & mobile",
  MOBILE: "Mobile",
  IN_PERSON: "In-person",
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function truncateBio(bio: string, maxLen = 200): string {
  // pure function at module scope - so you can unit test independently
  if (bio.length <= maxLen) return bio;
  // Cut at last space before maxLen to avoid mid-word truncation
  const trimmed = bio.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed) + "…";
}

interface ProviderCardProps {
  provider: ProviderSearchResult;
  /** Hide distance on landing page where it's meaningless */
  showDistance?: boolean;
}

function ProviderCard({ provider, showDistance = true }: ProviderCardProps) {
  const locationParts: string[] = [];
  if (provider.nearest_location_city) locationParts.push(provider.nearest_location_city);
  if (provider.nearest_location_state) locationParts.push(provider.nearest_location_state);
  const locationStr = locationParts.join(", ");

  return (
    <div className="provider-card">
      {/* ── Photo column ── */}
      <div className="provider-card-photo">
        <img
          src={provider.photo_url || defaultAvatar}
          alt={provider.display_name}
          className="provider-card-img"
        />
      </div>

      {/* ── Info column ── */}
      <div className="provider-card-info">
        <Link
          to={`/providers/${provider.slug}/${provider.id}`}
          className="provider-card-name"
        >
          {provider.display_name}
        </Link>

        {/* Credential codes + title line */}
        <div className="provider-card-credentials">
          {provider.credentials.length > 0 && (
            <span className="provider-card-codes">
              {provider.credentials.join(", ")}
            </span>
          )}
          {provider.credentials.length > 0 && provider.title_line && (
            <span className="provider-card-separator"> · </span> /* add dot separator here so you can do it conditionally (and not in the css) */
          )}
          {provider.title_line && (
            <span className="provider-card-title-line">
              {provider.title_line}
            </span>
          )}
        </div>

        {/* Location + distance + availability */}
        <div className="provider-card-meta">
          {locationStr && (
            <span className="provider-card-location">{locationStr}</span>
          )}
          {showDistance && provider.distance_miles > 0 && ( // number for comparison
            <span className="provider-card-distance">
              {provider.distance_miles.toFixed(1) /* truncated number as string */} mi
            </span>
          )}
          {provider.availability && (
            <span className="provider-card-availability">
              {AVAILABILITY_LABELS[provider.availability] ?? provider.availability}
            </span>
          )}
        </div>

        {/* Tags as small chips */}
        {provider.tags.length > 0 && (
          <div className="provider-card-tags">
            {provider.tags.map((tag) => (
              <span key={tag} className="provider-card-tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Truncated bio */}
        {provider.bio && (
          <p className="provider-card-bio">{truncateBio(provider.bio)}</p>
        )}
      </div>

      {/* ── Action column ── */}
      <div className="provider-card-actions">
        {provider.phone && (
          <a href={`tel:${provider.phone}` /*raw digits for the tel: href*/} className="provider-card-phone">
            {formatPhone(provider.phone) /*formatted phone for display*/}
          </a>
        )}
        {provider.public_email && (
          <a
            href={`mailto:${provider.public_email}`}
            className="btn btn-outline provider-card-btn"
          >
            Email
          </a>
        )}
        <Link
          to={`/providers/${provider.slug}/${provider.id}`}
          className="btn btn-outline provider-card-btn"
        >
          View
        </Link>
      </div>
    </div>
  );
}

export default ProviderCard;
