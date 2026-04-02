/**
 * ListInput — type-to-add widget for string array fields.
 *
 * Used for: services, specialties, populations_served, insurance_accepted,
 * tags, languages. Provider types a value, presses Enter or clicks Add,
 * and it appears as a removable chip.
 *
 * Deduplicates case-insensitively. Trims whitespace. Does not allow
 * empty strings.
 */

import { useState, type KeyboardEvent } from "react";

interface ListInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export default function ListInput({
  value,
  onChange,
  placeholder,
}: ListInputProps) {
  // input state is local — accordion-safe by design. Closing the accordion 
  // destroys whatever's in the text input, but the chips (the real data) live in 
  // IntakeProfile via value/onChange. Same safe pattern as PhotoUpload. Someone 
  // half-typing "periodon—" then closing the accordion loses those keystrokes, which is correct.
  const [input, setInput] = useState("");

  function addItem() {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Deduplicate case-insensitively
    const exists = value.some(
      (v) => v.toLowerCase() === trimmed.toLowerCase()
    );
    if (!exists) {
      onChange([...value, trimmed]);
    }
    setInput("");
  }

  function removeItem(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit parent form
      addItem();
    }
  }

  return (
    <div className="list-input">
      <div className="list-input-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button type="button" onClick={addItem} className="btn btn-small">
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="list-input-chips">
          {value.map((item, i) => (
            <span key={item} className="chip" /* use {item}=key not {i}=index to track state in react */ >
              {item}
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="chip-remove"
                aria-label={`Remove ${item}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
