/**
 * Sprint 7 — LocationEntry component tests.
 *
 * The most complex Sprint 6 component: fetches locations on mount,
 * splits them into public/private sections, has add forms with
 * validation, toggle is_public via PATCH, and delete with
 * window.confirm gate.
 *
 * Mocks all four location API functions. Uses vi.spyOn for
 * window.confirm since the delete handler reads its return value.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocationEntry from "../components/LocationEntry";

// ── Mock API client ────────────────────────────────────────────────

vi.mock("../api/client", () => ({
  apiGetLocations: vi.fn(),
  apiCreateLocation: vi.fn(),
  apiUpdateLocation: vi.fn(),
  apiDeleteLocation: vi.fn(),
}));

import {
  apiGetLocations,
  apiCreateLocation,
  apiDeleteLocation,
} from "../api/client";

// ── Fixture data ───────────────────────────────────────────────────

const MOCK_LOCATIONS = [
  {
    id: "loc-1",
    label: "Main Office",
    practice_name: "Pacific Dental",
    address_line1: "123 Main St",
    address_line2: null,
    city: "Portland",
    state: "OR",
    zip_code: "97201",
    latitude: null,
    longitude: null,
    is_primary: true,
    is_public: true,
  },
  {
    id: "loc-2",
    label: "Travel base",
    practice_name: null,
    address_line1: null,
    address_line2: null,
    city: "Hillsboro",
    state: "OR",
    zip_code: "97123",
    latitude: null,
    longitude: null,
    is_primary: false,
    is_public: false,
  },
];

// ── Tests ──────────────────────────────────────────────────────────

describe("LocationEntry", () => {
  beforeEach(() => {
    vi.mocked(apiGetLocations).mockResolvedValue(MOCK_LOCATIONS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state, then renders public and private sections", async () => {
    render(<LocationEntry />);

    expect(screen.getByText("Loading locations…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });
    // Public section
    expect(screen.getByText("Pacific Dental")).toBeInTheDocument();
    // Private section
    expect(screen.getByText("Travel base")).toBeInTheDocument();
  });

  it("opens add form when '+ Add practice location' is clicked", async () => {
    const user = userEvent.setup();
    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: "+ Add practice location" })
    );

    // Form has Label input, a submit button, and Cancel
    expect(screen.getByRole("button", { name: "Add location" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("submits add form and renders the new location card", async () => {
    const user = userEvent.setup();
    const newLoc = {
      id: "loc-3",
      label: "Community Clinic",
      practice_name: null,
      address_line1: null,
      address_line2: null,
      city: "Salem",
      state: "OR",
      zip_code: null,
      latitude: null,
      longitude: null,
      is_primary: false,
      is_public: true,
    };
    vi.mocked(apiCreateLocation).mockResolvedValue(newLoc);

    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Open the public add form
    await user.click(
      screen.getByRole("button", { name: "+ Add practice location" })
    );

    // Fill in label (the form's <label>Label<input/></label>)
    await user.type(screen.getByLabelText("Label"), "Community Clinic");

    // Submit
    await user.click(
      screen.getByRole("button", { name: "Add location" })
    );

    expect(apiCreateLocation).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Community Clinic")).toBeInTheDocument();
    });
  });

  it("deletes a location after window.confirm returns true", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(apiDeleteLocation).mockResolvedValue(undefined);

    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Two location cards → two Remove buttons
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith("Remove this location?");
    expect(apiDeleteLocation).toHaveBeenCalledWith("loc-1");

    await waitFor(() => {
      expect(screen.queryByText("Main Office")).not.toBeInTheDocument();
    });
    // The other location should still be there
    expect(screen.getByText("Travel base")).toBeInTheDocument();
  });
});
