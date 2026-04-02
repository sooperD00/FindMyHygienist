/**
 * PhotoUpload — profile photo management.
 *
 * Shows current photo or a default avatar placeholder.
 * Upload via POST /api/me/photo (multipart/form-data).
 * Delete via DELETE /api/me/photo.
 *
 * ADR-014: Photo is the first accordion in Step 2 (focus group
 * asked for it first) but closed by default (providers invest
 * seriously in their professional image — not a conference selfie).
 *
 * Uses <input type="file" accept="image/*"> which triggers the
 * native camera/gallery picker on mobile. No custom camera needed.
 */

import { useRef, useState } from "react";
import { apiUploadPhoto, apiDeletePhoto } from "../api/client";
import defaultAvatar from "../assets/default-avatar.svg";

// photo URL lives here, so accordion close is safe
interface PhotoUploadProps {
  currentUrl: string | null;
  onPhotoChange: (url: string | null) => void;
}

export default function PhotoUpload({
  currentUrl,
  onPhotoChange,
}: PhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // client-side file size check (get an error fast so you don't have to wait for the BE)
    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5 MB");
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const result = await apiUploadPhoto(file);
      onPhotoChange(result.photo_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      // Reset so selecting the same file again triggers onChange
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await apiDeletePhoto();
      onPhotoChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="photo-upload">
      <div className="photo-preview">
        <img
          src={currentUrl || defaultAvatar}
          alt={currentUrl ? "Your profile photo" : "No photo uploaded"}
          className={`photo-img ${!currentUrl ? "photo-img-placeholder" : ""}`}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="photo-actions">
        {/* wrap <input type="file" hidden> in a <label> - 
            clicking the label triggers the file picker - makes
            a button instead of the browser's ugly default*/}
        <label className="btn btn-small photo-upload-label">
          {uploading
            ? "Uploading…"
            : currentUrl
              ? "Change photo"
              : "Upload photo"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={uploading}
            hidden  // hidden input button/label trick
          />
        </label>
        {currentUrl && (
          <button
            type="button"
            onClick={handleDelete}
            className="btn btn-small btn-danger"
          >
            Remove
          </button>
        )}
      </div>
      <small className="helper-text">JPEG, PNG, or WebP. Max 5 MB.</small>
    </div>
  );
}
