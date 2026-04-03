/**
 * useSaveState — per-section save state management.
 *
 * Extracted from IntakeProfile (Sprint 9) so Dashboard can reuse
 * the same saving → saved ✓ → idle cycle.
 *
 * Usage:
 *   const bio = useSaveState();
 *   <SaveButton {...bio} onClick={() => bio.run(() => apiUpdateProfile({ bio }))} />
 */

import { useState, useCallback } from "react";

export interface SaveState {
  saving: boolean;
  saved: boolean;
  error: string | null;
  run: (fn: () => Promise<void>) => Promise<void>;
}

export function useSaveState(): SaveState {
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
