/**
 * Sprint 7 — PhotoUpload component tests.
 *
 * Mocks apiUploadPhoto and apiDeletePhoto. Tests the two visual
 * states (no photo / has photo), the upload flow (file select →
 * API call → callback), and the delete flow.
 *
 * The hidden <input type="file"> is wrapped in a <label> that acts
 * as the visible button. userEvent.upload() targets the input
 * directly since the label click → file picker flow doesn't work
 * in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotoUpload from "../components/PhotoUpload";

// ── Mock API client ────────────────────────────────────────────────

vi.mock("../api/client", () => ({
  apiUploadPhoto: vi.fn(),
  apiDeletePhoto: vi.fn(),
}));

import { apiUploadPhoto, apiDeletePhoto } from "../api/client";

// ── Tests ──────────────────────────────────────────────────────────

describe("PhotoUpload", () => {
  beforeEach(() => {
    vi.mocked(apiUploadPhoto).mockResolvedValue({
      photo_url: "https://cdn.example.com/photo.jpg",
    });
    vi.mocked(apiDeletePhoto).mockResolvedValue({ photo_url: null });
  });

  it("shows default avatar and 'Upload photo' when no photo exists", () => {
    render(<PhotoUpload currentUrl={null} onPhotoChange={vi.fn()} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "No photo uploaded");
    expect(screen.getByText("Upload photo")).toBeInTheDocument();
    // No Remove button when there's no photo
    expect(
      screen.queryByRole("button", { name: "Remove" })
    ).not.toBeInTheDocument();
  });

  it("shows photo, 'Change photo', and Remove when photo exists", () => {
    render(
      <PhotoUpload
        currentUrl="https://cdn.example.com/existing.jpg"
        onPhotoChange={vi.fn()}
      />
    );

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Your profile photo");
    expect(img).toHaveAttribute(
      "src",
      "https://cdn.example.com/existing.jpg"
    );
    expect(screen.getByText("Change photo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove" })
    ).toBeInTheDocument();
  });

  it("uploads file and calls onPhotoChange with new URL", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();
    render(<PhotoUpload currentUrl={null} onPhotoChange={onPhotoChange} />);

    const file = new File(["pixels"], "headshot.jpg", { type: "image/jpeg" });
    // The visible "Upload photo" text is a <label> wrapping a hidden <input>.
    // Target the input directly for userEvent.upload().
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(apiUploadPhoto).toHaveBeenCalledWith(file);
    });
    expect(onPhotoChange).toHaveBeenCalledWith(
      "https://cdn.example.com/photo.jpg"
    );
  });

  it("deletes photo and calls onPhotoChange(null)", async () => {
    const user = userEvent.setup();
    const onPhotoChange = vi.fn();
    render(
      <PhotoUpload
        currentUrl="https://cdn.example.com/existing.jpg"
        onPhotoChange={onPhotoChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(apiDeletePhoto).toHaveBeenCalled();
    });
    expect(onPhotoChange).toHaveBeenCalledWith(null);
  });
});
