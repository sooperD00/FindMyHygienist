/**
 * Sprint 7 — Accordion component tests.
 *
 * Pure UI component, no API calls. Tests the open/close toggle,
 * defaultOpen prop, and the load-bearing type="button" that prevents
 * form submission when the accordion lives inside a <form>.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Accordion from "../components/Accordion";

describe("Accordion", () => {
  it("renders title and hides content by default", () => {
    render(
      <Accordion title="Test Section">
        <p>Hidden content</p>
      </Accordion>
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("shows content immediately when defaultOpen is true", () => {
    render(
      <Accordion title="Open Section" defaultOpen>
        <p>Visible content</p>
      </Accordion>
    );

    expect(screen.getByText("Visible content")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("toggles content open and closed on click", async () => {
    const user = userEvent.setup();
    render(
      <Accordion title="Toggle Me">
        <p>Toggle content</p>
      </Accordion>
    );

    // Closed initially
    expect(screen.queryByText("Toggle content")).not.toBeInTheDocument();

    // Click → open
    await user.click(screen.getByRole("button"));
    expect(screen.getByText("Toggle content")).toBeInTheDocument();

    // Click → closed again
    await user.click(screen.getByRole("button"));
    expect(screen.queryByText("Toggle content")).not.toBeInTheDocument();
  });

  it("has type='button' to prevent form submission", () => {
    // Inside IntakeProfile, accordions live inside a form-like structure.
    // Without type="button", clicking a header would submit the form.
    render(
      <Accordion title="Form Safe">
        <p>Content</p>
      </Accordion>
    );

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
