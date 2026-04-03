/**
 * Sprint 7 + Sprint 9 — LocationEntry component tests.
 *
 * Sprint 7: fetches, splits public/private, add forms, toggle, delete.
 * Sprint 9: inline edit mode — click Edit, modify fields, save calls
 *           apiUpdateLocation with the changed fields.
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
  apiUpdateLocation,
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

  /* ── Sprint 9: inline edit mode ────────────────────────────── */

  it("shows Edit button on each location card", async () => {
    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    expect(editButtons).toHaveLength(2); // one per location
  });

  it("switches to edit form when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Click Edit on the first (public) location
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    // Edit form should have Save changes and Cancel buttons
    expect(
      screen.getByRole("button", { name: "Save changes" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" })
    ).toBeInTheDocument();

    // The Label input should be pre-populated
    const labelInput = screen.getByLabelText("Label");
    expect(labelInput).toHaveValue("Main Office");
  });

  it("calls apiUpdateLocation on edit save", async () => {
    const user = userEvent.setup();
    const updatedLoc = {
      ...MOCK_LOCATIONS[0],
      label: "Downtown Office",
    };
    vi.mocked(apiUpdateLocation).mockResolvedValue(updatedLoc);

    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Click Edit
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    // Clear and retype the label
    const labelInput = screen.getByLabelText("Label");
    await user.clear(labelInput);
    await user.type(labelInput, "Downtown Office");

    // Save
    await user.click(
      screen.getByRole("button", { name: "Save changes" })
    );

    expect(apiUpdateLocation).toHaveBeenCalledWith("loc-1", expect.objectContaining({
      label: "Downtown Office",
    }));

    // Card should show updated label
    await waitFor(() => {
      expect(screen.getByText("Downtown Office")).toBeInTheDocument();
    });
  });

  it("cancels edit and returns to card view", async () => {
    const user = userEvent.setup();
    render(<LocationEntry />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Click Edit
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[0]);

    // Cancel
    await user.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    // Should be back to card view with original label
    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument();
  });
});
