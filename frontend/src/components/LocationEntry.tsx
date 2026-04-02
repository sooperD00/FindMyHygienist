/**
 * LocationEntry — practice location management.
 *
 * ADR-013 + ADR-014 layout:
 *   - Public locations (is_public=true) on top, green accent
 *   - Private locations (is_public=false) on bottom, blue accent
 *   - Toggle on each card swaps is_public (moves between sections)
 *   - "Based in" location from Step 1 appears in private section
 *
 * Each location operation (add/edit/delete/toggle) is a hard save
 * to the API — no batching, no "save all" button.
 *
 * Fetches GET /api/me/locations on mount. The Step 1 "home base"
 * location is already in the DB, so it appears automatically.
 * 
 * This component manages its own state and fetches data on mount - not in Accordion.tsx
 * Closing the accordion destroys it, reopening remounts and re-fetches 
 * from the server. Saved locations are safe. A half-filled add form is lost.
 * OK for location data with saves for each location (bad for something like bio maybe).
 * 
 * TODO: Consider getting already-fetched `get /api/me/locations` as a prop since
 * IntakeProfile (which includes `locations` on `OwnProfile`) fetches the full profile
 * 
 * TODO: Consider useSaveState hook like in IntakeProfile to handle multiple action errors
 */

import { useEffect, useState } from "react";
import {
  apiGetLocations,
  apiCreateLocation,
  apiUpdateLocation,
  apiDeleteLocation,
} from "../api/client";
import type { OwnLocation, LocationCreate } from "../types/provider";

// ── Empty form state ──────────────────────────────────────────────

function emptyForm(isPublic: boolean): LocationCreate {
  return {
    label: isPublic ? "" : "Travel base",
    practice_name: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: "OR",
    zip_code: null,
    is_primary: false,
    is_public: isPublic,
  };
}

// ── Location card ─────────────────────────────────────────────────

function LocationCard({
  loc,
  onTogglePublic,
  onDelete,
}: {
  loc: OwnLocation;
  onTogglePublic: () => void;
  onDelete: () => void;
}) {
  const summary = [loc.city, loc.state].filter(Boolean).join(", ");
  const address = [loc.address_line1, loc.address_line2]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`location-card ${loc.is_public ? "location-card-public" : "location-card-private"}`}
    >
      <div className="location-card-header">
        <strong>{loc.label}</strong>
        {loc.practice_name && (
          <span className="location-practice">{loc.practice_name}</span>
        )}
        {loc.is_primary && <span className="location-badge">Primary</span>}
      </div>
      <div className="location-card-detail">
        {address && <span>{address}</span>}
        {summary && <span>{summary}</span>}
        {loc.zip_code && <span>{loc.zip_code}</span>}
      </div>
      <div className="location-card-actions">
        <label className="location-toggle">
          <input
            type="checkbox"
            checked={loc.is_public}
            onChange={onTogglePublic}
          />
          Show on my profile
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="btn btn-small btn-danger"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Add location form ─────────────────────────────────────────────

function AddLocationForm({
  isPublic,
  onAdd,
  onCancel,
}: {
  isPublic: boolean;
  onAdd: (data: LocationCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<LocationCreate>(emptyForm(isPublic));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof LocationCreate, value: string | boolean | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.label?.trim()) {
      setError("Label is required");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add location");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="location-add-form">
      {error && <p className="form-error">{error}</p>}

      <label>
        Label
        <input
          type="text"
          value={form.label}
          onChange={(e) => update("label", e.target.value)}
          placeholder={isPublic ? 'e.g. "Main Office", "Community Health Center"' : 'e.g. "Travel base", "Home area"'}
        />
      </label>

      {isPublic && (
        <label>
          Practice name
          <input
            type="text"
            value={form.practice_name || ""}
            onChange={(e) => update("practice_name", e.target.value || null)}
            placeholder="e.g. Pacific Dental Services"
          />
        </label>
      )}

      {isPublic && (
        <label>
          Address
          <input
            type="text"
            value={form.address_line1 || ""}
            onChange={(e) => update("address_line1", e.target.value || null)}
            placeholder="Street address"
          />
        </label>
      )}

      <div className="location-form-row">
        <label className="location-form-city">
          City
          <input
            type="text"
            value={form.city || ""}
            onChange={(e) => update("city", e.target.value || null)}
          />
        </label>
        <label className="location-form-state">
          State
          <input
            type="text"
            value={form.state || "OR"}
            onChange={(e) => update("state", e.target.value)}
            maxLength={2}
          />
        </label>
        <label className="location-form-zip">
          Zip
          <input
            type="text"
            value={form.zip_code || ""}
            onChange={(e) => update("zip_code", e.target.value || null)}
            placeholder="97123"
          />
        </label>
      </div>

      <label className="location-toggle">
        <input
          type="checkbox"
          checked={form.is_public ?? isPublic}
          onChange={(e) => update("is_public", e.target.checked)}
        />
        Show on my profile
      </label>
      <small className="helper-text">
        {form.is_public
          ? "Patients will see this location's name and city on your profile."
          : "This location is used for search only. Patients won't see it."}
      </small>

      <div className="location-form-actions">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="btn btn-small"
        >
          {submitting ? "Adding…" : "Add location"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-small btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function LocationEntry() {
  const [locations, setLocations] = useState<OwnLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingPublic, setAddingPublic] = useState(false);
  const [addingPrivate, setAddingPrivate] = useState(false);

  useEffect(() => {
    apiGetLocations()
      .then(setLocations)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load locations")
      )
      .finally(() => setLoading(false));
  }, []);

  const publicLocs = locations.filter((l) => l.is_public);
  const privateLocs = locations.filter((l) => !l.is_public);

  async function handleAdd(data: LocationCreate) {
    const loc = await apiCreateLocation(data);
    setLocations((prev) => [...prev, loc]);
    setAddingPublic(false);
    setAddingPrivate(false);
  }

  async function handleTogglePublic(loc: OwnLocation) {
    try {
      const updated = await apiUpdateLocation(loc.id, {
        is_public: !loc.is_public,
      });
      setLocations((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleDelete(id: string) {
  if (!window.confirm("Remove this location?")) return;
    try {
      await apiDeleteLocation(id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  if (loading) return <p className="helper-text">Loading locations…</p>;

  return (
    <div className="location-entry">
      {error && <p className="form-error">{error}</p>}

      {/* ── Public locations ─────────────────────────────── */}
      <div className="location-section location-section-public">
        <h4>
          Practice locations{" "}
          <small className="helper-text">— visible on your profile</small>
        </h4>
        {publicLocs.length === 0 && !addingPublic && (
          <p className="location-empty">
            e.g. "Main Office — Portland, OR" or "Salem Community Health Center"
          </p>
        )}
        {publicLocs.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            onTogglePublic={() => handleTogglePublic(loc)}
            onDelete={() => handleDelete(loc.id)}
          />
        ))}
        {addingPublic ? (
          <AddLocationForm
            isPublic={true}
            onAdd={handleAdd}
            onCancel={() => setAddingPublic(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingPublic(true)}
            className="btn btn-small btn-secondary"
          >
            + Add practice location
          </button>
        )}
      </div>

      {/* ── Private locations ────────────────────────────── */}
      <div className="location-section location-section-private">
        <h4>
          Travel-from locations{" "}
          <small className="helper-text">
            — for search only, not shown on your profile
          </small>
        </h4>
        {privateLocs.length === 0 && !addingPrivate && (
          <p className="location-empty">
            e.g. your home area zip code so patients near you can find you
          </p>
        )}
        {privateLocs.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            onTogglePublic={() => handleTogglePublic(loc)}
            onDelete={() => handleDelete(loc.id)}
          />
        ))}
        {addingPrivate ? (
          <AddLocationForm
            isPublic={false}
            onAdd={handleAdd}
            onCancel={() => setAddingPrivate(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingPrivate(true)}
            className="btn btn-small btn-secondary"
          >
            + Add travel-from location
          </button>
        )}
      </div>
    </div>
  );
}
