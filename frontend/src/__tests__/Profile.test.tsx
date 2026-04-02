/**
 * Sprint 8 — Profile page tests.
 *
 * The Profile page is the public-facing provider profile at
 * /providers/:slug/:id. Tests cover the loading state, successful
 * render with all sections, default avatar fallback, credential
 * chip popover (open AND close), 404 handling, generic error
 * handling, and the "report an issue" link.
 *
 * Mocking strategy:
 *   - apiGetPublicProfile is mocked via vi.mock (same as other tests).
 *   - MemoryRouter wraps the component with initialEntries pointing
 *     to a profile route so useParams() resolves slug and id.
 *   - No AuthProvider needed — the profile page is public.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Profile from "../pages/Profile";

// ── Hoisted mocks ──────────────────────────────────────────────

const { mockGetPublicProfile } = vi.hoisted(() => ({
  mockGetPublicProfile: vi.fn(),
}));

vi.mock("../api/client", () => ({
  apiGetPublicProfile: (...args: unknown[]) => mockGetPublicProfile(...args),
}));

// ── Test data ──────────────────────────────────────────────────

const MOCK_PROFILE = {
  id: "abc-123",
  display_name: "Ginger Davidson",
  slug: "ginger-davidson",
  provider_type: "DENTAL_HYGIENIST",
  title_line: "Registered Dental Hygienist, BSDH",
  bio: "I provide compassionate dental hygiene care.\n\nSpecializing in pediatric and geriatric patients.",
  mission_statement: "Everyone deserves a healthy smile.",
  photo_url: "/uploads/photos/ginger.jpg",
  phone: "5035551234",
  public_email: "ginger@example.com",
  website: "https://gingerdental.com",
  languages: ["English", "Spanish"],
  services: ["cleanings", "sealants", "fluoride treatments"],
  specialties: ["pediatric", "geriatric"],
  populations_served: ["children", "seniors"],
  insurance_accepted: ["OHP", "Delta Dental"],
  tags: ["anxiety-friendly", "LGBTQ-affirming"],
  availability: "BOTH",
  accepting_new_patients: true,
  max_travel_miles: 25,
  accepts_texts: true,
  accepts_calls: true,
  credentials: [
    {
      code: "RDH",
      full_name: "Registered Dental Hygienist",
      patient_description: "Licensed to clean teeth and provide preventive care.",
      credential_type: "LICENSE",
    },
    {
      code: "EPDH",
      full_name: "Expanded Practice Dental Hygienist",
      patient_description:
        "Can provide care WITHOUT a dentist present — in schools, nursing homes, mobile clinics, or their own practice.",
      credential_type: "LICENSE",
    },
  ],
  locations: [
    {
      id: "loc-1",
      label: "Main Office",
      practice_name: "Pacific Dental Services",
      city: "Portland",
      state: "OR",
      is_primary: true,
    },
    {
      id: "loc-2",
      label: "Community Health Center",
      practice_name: null,
      city: "Salem",
      state: "OR",
      is_primary: false,
    },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────

/** Render Profile inside a MemoryRouter with the right route. */
function renderProfile(slug = "ginger-davidson", id = "abc-123") {
  return render(
    <MemoryRouter initialEntries={[`/providers/${slug}/${id}`]}>
      <Routes>
        <Route path="/providers/:slug/:id" element={<Profile />} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Mock the API, render, and wait for the profile to load.
 * Returns a userEvent instance so callers can interact immediately.
 */
async function renderLoadedProfile(overrides = {}) {
  mockGetPublicProfile.mockResolvedValue({ ...MOCK_PROFILE, ...overrides });
  const result = renderProfile();

  await waitFor(() => {
    expect(screen.getByText("Ginger Davidson")).toBeInTheDocument();
  });

  return { user: userEvent.setup(), container: result.container };
}

// ── Tests ──────────────────────────────────────────────────────

describe("Profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ── Loading & data fetching ─────────────────────────────── */

  it("shows loading state initially", () => {
    // Never-resolving promise to keep it in loading state
    mockGetPublicProfile.mockReturnValue(new Promise(() => {}));
    renderProfile();
    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  it("calls apiGetPublicProfile with slug and id from route params", async () => {
    await renderLoadedProfile();

    expect(mockGetPublicProfile).toHaveBeenCalledWith(
      "ginger-davidson",
      "abc-123"
    );
  });

  /* ── Hero section ────────────────────────────────────────── */

  it("renders provider name and title after fetch", async () => {
    await renderLoadedProfile();

    expect(screen.getByText("Ginger Davidson")).toBeInTheDocument();
    expect(
      screen.getByText("Registered Dental Hygienist, BSDH")
    ).toBeInTheDocument();
  });

  it("renders provider photo when photo_url is present", async () => {
    await renderLoadedProfile();

    const img = screen.getByAltText("Ginger Davidson's photo");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/uploads/photos/ginger.jpg");
  });

  /* too broad
  it("renders default avatar when photo_url is null", async () => {
    await renderLoadedProfile({ photo_url: null });

    // The placeholder img has aria-hidden="true" and no meaningful alt
    const placeholder = screen.getByRole("img", { hidden: true }); 
    expect(placeholder).toHaveClass("profile-photo-placeholder");
  });*/

  it("renders default avatar when photo_url is null", async () => {
    const { container } = await renderLoadedProfile({ photo_url: null });
    const placeholder = container.querySelector(".profile-photo-placeholder");
    expect(placeholder).toBeInTheDocument();
  });

  it("renders 'Accepting new patients' badge", async () => {
    await renderLoadedProfile();

    expect(
      screen.getByText("Accepting new patients")
    ).toBeInTheDocument();
  });

  it("renders 'In-person & mobile' for BOTH availability", async () => {
    await renderLoadedProfile({ availability: "BOTH" });
    expect(screen.getByText("In-person & mobile")).toBeInTheDocument();
  });

  it("renders 'Mobile' for MOBILE availability", async () => {
    await renderLoadedProfile({ availability: "MOBILE" });
    expect(screen.getByText("Mobile")).toBeInTheDocument();
  });

  it("renders 'In-person' for IN_PERSON availability", async () => {
    await renderLoadedProfile({ availability: "IN_PERSON" });
    expect(screen.getByText("In-person")).toBeInTheDocument();
  });

  /* ── Credential chips ────────────────────────────────────── */

  it("renders credential chips", async () => {
    await renderLoadedProfile();

    expect(screen.getByText("RDH")).toBeInTheDocument();
    expect(screen.getByText("EPDH")).toBeInTheDocument();
  });

  it("shows credential popover on click", async () => {
    const { user } = await renderLoadedProfile();

    await user.click(screen.getByText("EPDH"));

    await waitFor(() => {
      expect(
        screen.getByText("Expanded Practice Dental Hygienist")
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Can provide care WITHOUT a dentist present/)
    ).toBeInTheDocument();
  });

  it("closes credential popover on second click", async () => {
    const { user } = await renderLoadedProfile();

    await user.click(screen.getByText("EPDH"));
    await waitFor(() => {
      expect(
        screen.getByText("Expanded Practice Dental Hygienist")
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText("EPDH"));
    await waitFor(() => {
      expect(
        screen.queryByText("Expanded Practice Dental Hygienist")
      ).not.toBeInTheDocument();
    });
  });

  it("closes credential popover on outside click", async () => {
    const { user } = await renderLoadedProfile();

    await user.click(screen.getByText("EPDH"));
    await waitFor(() => {
      expect(
        screen.getByText("Expanded Practice Dental Hygienist")
      ).toBeInTheDocument();
    });

    // Click somewhere else on the page
    await user.click(screen.getByText("Ginger Davidson"));
    await waitFor(() => {
      expect(
        screen.queryByText("Expanded Practice Dental Hygienist")
      ).not.toBeInTheDocument();
    });
  });

  /* ── Contact info ────────────────────────────────────────── */

  it("renders contact info with phone, email, and website", async () => {
    await renderLoadedProfile();

    expect(screen.getByText("(503) 555-1234")).toBeInTheDocument();
    expect(screen.getByText("ginger@example.com")).toBeInTheDocument();
    expect(screen.getByText("gingerdental.com")).toBeInTheDocument();
    expect(screen.getByText("Accepts texts")).toBeInTheDocument();
  });

  /* ── Bio section ─────────────────────────────────────────── */

  it("renders bio paragraphs", async () => {
    await renderLoadedProfile();

    expect(
      screen.getByText("I provide compassionate dental hygiene care.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Specializing in pediatric and geriatric patients.")
    ).toBeInTheDocument();
  });

  it("renders mission statement as blockquote", async () => {
    await renderLoadedProfile();

    expect(
      screen.getByText("Everyone deserves a healthy smile.")
    ).toBeInTheDocument();
  });

  /* ── Detail chips ────────────────────────────────────────── */

  it("renders detail chips for services, specialties, etc.", async () => {
    await renderLoadedProfile();

    expect(screen.getByText("cleanings")).toBeInTheDocument();
    expect(screen.getByText("sealants")).toBeInTheDocument();
    expect(screen.getByText("pediatric")).toBeInTheDocument();
    expect(screen.getByText("Delta Dental")).toBeInTheDocument();
    expect(screen.getByText("LGBTQ-affirming")).toBeInTheDocument();
    expect(screen.getByText("Spanish")).toBeInTheDocument();
  });

  /* ── Locations ───────────────────────────────────────────── */

  it("renders practice locations", async () => {
    await renderLoadedProfile();

    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(screen.getByText("Pacific Dental Services")).toBeInTheDocument();
    expect(screen.getByText("Portland, OR")).toBeInTheDocument();
    expect(screen.getByText("Community Health Center")).toBeInTheDocument();
    expect(screen.getByText("Salem, OR")).toBeInTheDocument();
  });

  /* ── Footer ──────────────────────────────────────────────── */

  it("renders 'Report an issue' link", async () => {
    await renderLoadedProfile();

    const link = screen.getByText("Report an issue with this listing");
    expect(link.getAttribute("href")).toContain("mailto:");
    expect(link.getAttribute("href")).toContain(import.meta.env.VITE_SUPPORT_EMAIL);
  });

  /* ── Error states ────────────────────────────────────────── */

  it("shows error state on 404", async () => {
    const err = new Error("Provider not found") as Error & { status: number };
    err.status = 404;
    mockGetPublicProfile.mockRejectedValue(err);
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Profile not found")).toBeInTheDocument();
    });
    expect(screen.getByText("Provider not found.")).toBeInTheDocument();
  });

  it("shows generic error on network failure", async () => {
    mockGetPublicProfile.mockRejectedValue(new Error("network fail"));
    renderProfile();

    await waitFor(() => {
      expect(
        screen.getByText("Something went wrong loading this profile.")
      ).toBeInTheDocument();
    });
  });

  /* ── Empty/optional data ─────────────────────────────────── */

  it("hides optional sections when data is empty", async () => {
    await renderLoadedProfile({
      bio: null,
      mission_statement: null,
      services: null,
      specialties: null,
      populations_served: null,
      insurance_accepted: null,
      tags: null,
      languages: null,
      phone: null,
      public_email: null,
      website: null,
      locations: [],
      credentials: [],
    });

    // These headings should NOT be present
    expect(screen.queryByText("About")).not.toBeInTheDocument();
    expect(screen.queryByText("Services")).not.toBeInTheDocument();
    expect(screen.queryByText("Practice Locations")).not.toBeInTheDocument();
  });
});
