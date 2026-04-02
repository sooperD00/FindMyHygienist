/**
 * Sprint 7 — ListInput component tests.
 *
 * Pure UI component: no API calls. Tests the add (click and Enter),
 * remove, empty state, and case-insensitive dedup behaviors.
 *
 * ListInput is used for 6 profile fields (services, specialties,
 * populations_served, insurance_accepted, tags, languages), so bugs
 * here ripple across the whole intake form.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListInput from "../components/ListInput";

describe("ListInput", () => {
  it("renders input and Add button with no chips when value is empty", () => {
    render(<ListInput value={[]} onChange={vi.fn()} placeholder="Add item" />);

    expect(screen.getByPlaceholderText("Add item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    // No remove buttons = no chips
    expect(
      screen.queryByRole("button", { name: /Remove/ })
    ).not.toBeInTheDocument();
  });

  it("adds item on Add button click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ListInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "cleanings");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onChange).toHaveBeenCalledWith(["cleanings"]);
  });

  it("adds item on Enter keypress", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ListInput value={[]} onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "sealants{Enter}");

    expect(onChange).toHaveBeenCalledWith(["sealants"]);
  });

  it("removes item when × button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ListInput value={["cleanings", "sealants"]} onChange={onChange} />
    );

    // Each chip has an aria-label "Remove <item>"
    await user.click(
      screen.getByRole("button", { name: "Remove cleanings" })
    );

    expect(onChange).toHaveBeenCalledWith(["sealants"]);
  });

  it("rejects case-insensitive duplicates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ListInput value={["Cleanings"]} onChange={onChange} />);

    await user.type(screen.getByRole("textbox"), "cleanings{Enter}");

    // onChange should NOT fire — "cleanings" matches "Cleanings"
    expect(onChange).not.toHaveBeenCalled();
  });
});
