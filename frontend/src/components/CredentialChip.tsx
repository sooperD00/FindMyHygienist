/**
 * CredentialChip — tappable credential pill for provider profiles.
 *
 * Renders a credential code (e.g. "EPDH") as a styled chip. On
 * click/tap, toggles a popover that shows the full_name and
 * patient_description from the Credential table. This is the feature
 * Focus Group #1 asked for: patients tap a code they don't recognize
 * and get a plain-English explanation of what it means.
 *
 * Uses click-to-toggle rather than hover because:
 *   1. The conference demo is on phones (no hover)
 *   2. patient_description can be 2-3 sentences — needs to persist
 *   3. Accessibility: click is more intentional than hover
 *
 * Close behavior: clicking the chip again, or clicking anywhere
 * else on the page (useEffect document listener).
 * 
 * Implements `useEffect` cleanup pattern: When `open` becomes true, the 
 * effect registers a `mousedown` listener on the entire document. Then,
 * `return () => document.removeEventListener(...)` cleans up
 */

import { useState, useRef, useEffect } from "react";
import type { Credential } from "../types/provider";

interface CredentialChipProps {
  credential: Credential;
}

function CredentialChip({ credential }: CredentialChipProps) {
  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return;  // no listener gets registered at all when the popover is closed, so there's zero cost when idle

    function handleClickOutside(e: MouseEvent) {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) { // as Node type assertion
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <span className="credential-chip-wrapper">
      <button
        ref={chipRef}
        className={`credential-chip ${open ? "credential-chip-active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}  // help screen readers know "this button is toggled open"
        aria-label={`${credential.code} — ${credential.full_name}`}
        type="button"  // defensive (in case someone later wraps the profile page in a form, this won't accidentally submit)
      >
        {credential.code}
      </button>
      {open && ( /* conditional rendering via short-circuit evaluation */
        <span className="credential-popover" role="tooltip" /* role="tooltip" tells assistive tech what the popover is */ >
          <strong>{credential.full_name}</strong>
          <span className="credential-popover-desc">
            {credential.patient_description}
          </span>
        </span>
      )}
    </span>
  );
}

export default CredentialChip;
