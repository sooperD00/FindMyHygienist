/**
 * CredentialSelector — checkbox grid grouped by credential type.
 *
 * Fetches GET /api/credentials on mount. Groups by credential_type
 * (LICENSE → DEGREE → PERMIT → SPECIALTY). Each checkbox shows the
 * code, full name, and patient_description as helper text.
 *
 * Parent tracks selected codes and calls PUT /api/me/credentials
 * on save. This component just manages the checkbox UI.
 *
 * ADR-010: credentials are a reference table seeded from Oregon
 * licensing data. Providers select from valid codes — no freeform.
 */

import { useEffect, useState } from "react";
import { apiGetCredentials } from "../api/client";
import type { Credential, CredentialType } from "../types/provider";

const TYPE_ORDER: CredentialType[] = [
  "LICENSE",
  "DEGREE",
  "PERMIT",
  "SPECIALTY",
];

const TYPE_LABELS: Record<CredentialType, string> = {
  LICENSE: "Licenses",
  DEGREE: "Degrees",
  PERMIT: "Permits",
  SPECIALTY: "Specialties",
};

interface CredentialSelectorProps {
  selected: string[];
  onChange: (codes: string[]) => void;
}

export default function CredentialSelector({
  selected,
  onChange,
}: CredentialSelectorProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGetCredentials()
      .then(setCredentials)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function toggle(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  }

  if (loading) return <p className="helper-text">Loading credentials…</p>;
  if (error) return <p className="form-error">{error}</p>;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    items: credentials.filter((c) => c.credential_type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="credential-selector">
      {grouped.map((group) => (
        <fieldset key={group.type} className="credential-group">
          <legend>{group.label}</legend>
          {group.items.map((cred) => (
            <label key={cred.code} className="credential-item">
              <input
                type="checkbox"
                checked={selected.includes(cred.code)}
                onChange={() => toggle(cred.code)}
              />
              <span className="credential-info">
                <strong>{cred.code}</strong> — {cred.full_name}
                <small className="helper-text">
                  {cred.patient_description}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
