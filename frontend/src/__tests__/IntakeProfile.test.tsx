/**
 * Sprint 7 — IntakeProfile component tests.
 *
 * Smoke-level tests for the big orchestrator. IntakeProfile loads a
 * profile, renders 10 accordion sections, and delegates to child
 * components (CredentialSelector, PhotoUpload, LocationEntry, ListInput).
 *
 * The child components have their own dedicated test files. These
 * tests verify the integration: does the page assemble correctly,
 * are the right sections default-open, does a per-section Save
 * call the right API function?
 *
 * Mocks every API function used by IntakeProfile and its children
 * so the full render tree can mount without errors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IntakeProfile from "../components/IntakeProfile";

// ── Mock every API function in the render tree ─────────────────────

vi.mock("../api/client", () => ({
  apiGetOwnProfile: vi.fn(),
  apiUpdateProfile: vi.fn(),
  apiUpdateCredentials: vi.fn(),
  apiGetCredentials: vi.fn(),
  apiGetLocations: vi.fn(),
  apiUploadPhoto: vi.fn(),
  apiDeletePhoto: vi.fn(),
  apiCreateLocation: vi.fn(),
  apiUpdateLocation: vi.fn(),
  apiDeleteLocation: vi.fn(),
}));

import {
  apiGetOwnProfile,
  apiUpdateProfile,
  apiGetCredentials,
  apiGetLocations,
} from "../api/client";

// ── Fixture ────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  id: "provider-1",
  display_name: "Jane Smith",
  slug: "jane-smith",
  provider_type: "DENTAL_HYGIENIST",
  title_line: null,
  bio: null,
  mission_statement: null,
  photo_url: null,
  phone: null,
  public_email: null,
  website: null,
  languages: null,
  services: null,
  specialties: null,
  populations_served: null,
  insurance_accepted: null,
  tags: null,
  availability: null,
  accepting_new_patients: true,
  max_travel_miles: 25,
  accepts_texts: false,
  accepts_calls: true,
  status: "PENDING" as const,
  draft: null,
  reviewed_at: null,
  credentials: [],
  locations: [],
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

// ── Tests ──────────────────────────────────────────────────────────

describe("IntakeProfile", () => {
  beforeEach(() => {
    vi.mocked(apiGetOwnProfile).mockResolvedValue(MOCK_PROFILE);
    // CredentialSelector mounts immediately (its accordion is default-open)
    vi.mocked(apiGetCredentials).mockResolvedValue([]);
    // LocationEntry only mounts when its accordion is opened (closed by default)
    vi.mocked(apiGetLocations).mockResolvedValue([]);
    vi.mocked(apiUpdateProfile).mockResolvedValue(MOCK_PROFILE);
  });

  it("shows loading text, then renders all 10 accordion section titles", async () => {
    render(<IntakeProfile onDone={vi.fn()} />);

    expect(screen.getByText("Loading your profile…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Profile Photo")).toBeInTheDocument();
    });

    const expectedTitles = [
      "Profile Photo",
      "Bio & Title Line",
      "Credentials",
      "Contact Preferences",
      "Specialties, Services & Populations Served",
      "Travel From & Practice Locations",
      "Insurance Accepted",
      "Languages",
      "Availability & Scheduling",
      "Tags & Additional Info",
    ];

    for (const title of expectedTitles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("opens Credentials and Contact Preferences by default", async () => {
    render(<IntakeProfile onDone={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Credentials")).toBeInTheDocument();
    });

    // aria-expanded="true" means the accordion is open
    const expandedButtons = screen.getAllByRole("button", { expanded: true });
    const expandedLabels = expandedButtons.map((btn) => btn.textContent);

    expect(expandedLabels.some((t) => t?.includes("Credentials"))).toBe(true);
    expect(
      expandedLabels.some((t) => t?.includes("Contact Preferences"))
    ).toBe(true);
    // Photo and Bio should be closed
    expect(
      expandedLabels.some((t) => t?.includes("Profile Photo"))
    ).toBe(false);
    expect(
      expandedLabels.some((t) => t?.includes("Bio & Title Line"))
    ).toBe(false);
  });

  it("calls apiUpdateProfile with bio fields when Bio section Save is clicked", async () => {
    const user = userEvent.setup();
    render(<IntakeProfile onDone={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Bio & Title Line")).toBeInTheDocument();
    });

    // Open the Bio accordion
    await user.click(screen.getByText("Bio & Title Line"));

    // Type into the bio textarea
    await user.type(screen.getByLabelText("Bio"), "I love teeth");

    // The Bio section's Save button is the first Save button in DOM order
    // (Photo is closed, Bio is now open, then Credentials and Contact are open)
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    await user.click(saveButtons[0]);

    expect(apiUpdateProfile).toHaveBeenCalledWith({
      title_line: null,
      bio: "I love teeth",
      mission_statement: null,
    });
  });

  it("calls onDone when the Done button is clicked", async () => {
    const onDone = vi.fn();
    render(<IntakeProfile onDone={onDone} />);

    await waitFor(() => {
      expect(screen.getByText("Profile Photo")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Done/ })
    );

    expect(onDone).toHaveBeenCalled();
  });
});
