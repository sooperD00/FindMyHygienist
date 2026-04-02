/**
 * Accordion — collapsible section with a clickable header.
 *
 * Used in the intake form (Step 2) for grouping profile fields.
 * ADR-014: accordion labels double as a feature list for browsing
 * customers — closed accordions are a promise, not a demand.
 *
 * No animation in Sprint 6. Sprint 11 is the polish pass.
 */

import { useState, type ReactNode } from "react";

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Accordion({
  title,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`accordion ${isOpen ? "accordion-open" : ""}`}>
      <button
        // This accordion lives inside the intake form. Without type="button", 
        // a <button> inside a <form> defaults to type="submit" — clicking any 
        // accordion header would submit the form. Easy to miss, important it's here.
        type="button"  // load-bearing
        className="accordion-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        // TODO: A full a11y pass would add aria-controls pointing to the content panel's id
      >
        <span className="accordion-title">{title}</span>
        <span className="accordion-chevron" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>
      { // Closed content is unmounted, not hidden
        // form state is managed by the parent (e.g. components/IntakeProfile.tsx)
        // else closing and reopening the accordion would wipe unsubmitted data
        isOpen && <div className="accordion-content">{children}</div>}
    </div>
  );
}
