/**
 * Sprint 7 — CredentialSelector component tests.
 *
 * Mocks apiGetCredentials to return a small fixture set.
 * Tests loading state, grouped fieldset rendering, and the
 * check/uncheck toggle that drives onChange.
 *
 * The real credential list has 17 entries across 4 types; the
 * fixture uses 3 entries (one per type) to keep tests readable
 * while still exercising the grouping logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CredentialSelector from "../components/CredentialSelector";

// ── Mock API client ────────────────────────────────────────────────

vi.mock("../api/client", () => ({
  apiGetCredentials: vi.fn(),
}));

import { apiGetCredentials } from "../api/client";

const MOCK_CREDENTIALS = [
  {
    code: "RDH",
    full_name: "Registered Dental Hygienist",
    patient_description: "Licensed to provide preventive dental care",
    credential_type: "LICENSE" as const,
  },
  {
    code: "BSDH",
    full_name: "Bachelor of Science in Dental Hygiene",
    patient_description: "Four-year dental hygiene degree",
    credential_type: "DEGREE" as const,
  },
  {
    code: "LAP",
    full_name: "Local Anesthesia Permit",
    patient_description: "Authorized to administer local anesthesia",
    credential_type: "PERMIT" as const,
  },
];

// ── Tests ──────────────────────────────────────────────────────────

describe("CredentialSelector", () => {
  beforeEach(() => {
    vi.mocked(apiGetCredentials).mockResolvedValue(MOCK_CREDENTIALS);
  });

  it("shows loading text, then renders grouped fieldsets", async () => {
    render(<CredentialSelector selected={[]} onChange={vi.fn()} />);

    // Loading state appears synchronously
    expect(screen.getByText("Loading credentials…")).toBeInTheDocument();

    // After the mock resolves, grouped legends appear
    await waitFor(() => {
      expect(screen.getByText("Licenses")).toBeInTheDocument();
    });
    expect(screen.getByText("Degrees")).toBeInTheDocument();
    expect(screen.getByText("Permits")).toBeInTheDocument();
  });

  it("renders checkbox for each credential with code and full name", async () => {
    render(<CredentialSelector selected={[]} onChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/RDH/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Registered Dental Hygienist/)
    ).toBeInTheDocument();
    expect(screen.getByText(/BSDH/)).toBeInTheDocument();
    expect(screen.getByText(/LAP/)).toBeInTheDocument();
  });

  it("calls onChange with code added when checkbox is checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CredentialSelector selected={[]} onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByText(/RDH/)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("checkbox", { name: /RDH/ }));

    expect(onChange).toHaveBeenCalledWith(["RDH"]);
  });

  it("calls onChange with code removed when checkbox is unchecked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CredentialSelector selected={["RDH", "BSDH"]} onChange={onChange} />
    );

    await waitFor(() => {
      expect(screen.getByText(/RDH/)).toBeInTheDocument();
    });

    // RDH is checked (selected includes it). Clicking unchecks it.
    await user.click(screen.getByRole("checkbox", { name: /RDH/ }));

    expect(onChange).toHaveBeenCalledWith(["BSDH"]);
  });
});
