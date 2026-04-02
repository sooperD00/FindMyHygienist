/**
 * Sprint 7 — Join page (wizard) tests.
 *
 * The Join page is a 3-step wizard: account creation → profile
 * build → confirmation. Tests cover the step indicator rendering,
 * the already-logged-in skip (page refresh during intake), and
 * the Step 1 → Step 2 transition on successful registration.
 *
 * Mocking strategy:
 *   - useAuth is mocked via vi.mock (not a real AuthProvider).
 *     The mock returns controlled values for user/register/etc.
 *   - All API client functions are mocked to prevent real fetches
 *     when IntakeProfile mounts in Step 2.
 *   - MemoryRouter wraps the component because Join uses <Link>.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Join from "../pages/Join";

// ── Hoisted mocks (available to vi.mock factories) ─────────────────

const { mockRegister, mockUseAuth } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock every API function the render tree might call.
// Step 1 calls apiCreateLocation + apiUpdateProfile after registration.
// Step 2 (IntakeProfile) calls apiGetOwnProfile + child API functions.
// Step 3 calls apiGetOwnProfile.
vi.mock("../api/client", () => ({
  apiCreateLocation: vi.fn().mockResolvedValue({}),
  apiUpdateProfile: vi.fn().mockResolvedValue({}),
  apiGetOwnProfile: vi.fn().mockResolvedValue({
    id: "p-1",
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
    status: "PENDING",
    draft: null,
    reviewed_at: null,
    credentials: [],
    locations: [],
    created_at: null,
    updated_at: null,
  }),
  apiGetCredentials: vi.fn().mockResolvedValue([]),
  apiGetLocations: vi.fn().mockResolvedValue([]),
  apiUploadPhoto: vi.fn(),
  apiDeletePhoto: vi.fn(),
  apiUpdateCredentials: vi.fn(),
  apiUpdateLocation: vi.fn(),
  apiDeleteLocation: vi.fn(),
}));

// ── Helper ─────────────────────────────────────────────────────────

function loggedOut() {
  mockUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
  });
}

function loggedIn() {
  mockUseAuth.mockReturnValue({
    user: { id: "u-1", email: "jane@test.com", role: "PROVIDER" },
    isLoading: false,
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe("Join wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Step 1 registration form when not logged in", () => {
    loggedOut();

    render(
      <MemoryRouter>
        <Join />
      </MemoryRouter>
    );

    expect(screen.getByText("List With Us")).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/provider type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/home base/i)).toBeInTheDocument();
  });

  it("skips to Step 2 when user is already logged in", async () => {
    loggedIn();

    render(
      <MemoryRouter>
        <Join />
      </MemoryRouter>
    );

    // The useEffect sees user + step===1 and advances to step 2
    await waitFor(() => {
      expect(screen.getByText("Build Your Profile")).toBeInTheDocument();
    });

    // Step 1 form should NOT be present
    expect(screen.queryByText("List With Us")).not.toBeInTheDocument();
  });

  it("calls register and advances to Step 2 on form submission", async () => {
    const user = userEvent.setup();
    loggedOut();

    // register() resolves successfully — Step1.handleSubmit then calls
    // onComplete() which sets step to 2 in the parent wizard.
    mockRegister.mockResolvedValue({
      user: { id: "u-1", email: "jane@test.com", role: "PROVIDER" },
    });

    render(
      <MemoryRouter>
        <Join />
      </MemoryRouter>
    );

    // Fill in the required fields
    await user.type(screen.getByLabelText(/full name/i), "Jane Smith");
    await user.type(screen.getByLabelText("Email"), "jane@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");

    // Submit
    await user.click(
      screen.getByRole("button", { name: /create account/i })
    );

    expect(mockRegister).toHaveBeenCalledWith({
      email: "jane@test.com",
      password: "password123",
      display_name: "Jane Smith",
      provider_type: "DENTAL_HYGIENIST", // default selection
    });

    // Should advance to Step 2
    await waitFor(() => {
      expect(screen.getByText("Build Your Profile")).toBeInTheDocument();
    });
  });
});
