/**
 * SaveButton — per-section save button with saving/saved/error states.
 *
 * Extracted from IntakeProfile (Sprint 9) for reuse in ProfileEditor.
 * Pairs with useSaveState hook — spread the hook's return value as props:
 *   <SaveButton {...bioSave} onClick={() => bioSave.run(fn)} />
 */

interface SaveButtonProps {
  saving: boolean;
  saved: boolean;
  error: string | null;
  onClick: () => void;
}

export default function SaveButton({
  saving,
  saved,
  error,
  onClick,
}: SaveButtonProps) {
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
