/**
 * Feedback — submit an issue report or general feedback.
 *
 * Route: /feedback
 *
 * Two entry points, one page:
 *   1. "Report an issue" from a provider profile →
 *      /feedback?type=REPORT_ISSUE&provider_id=X&provider_name=Y
 *   2. "Give us feedback" from the site footer →
 *      /feedback  (defaults to GENERAL_FEEDBACK)
 *
 * No auth required. Submits to POST /api/feedback, which writes
 * directly to the feedback table. No email, no inbox clutter —
 * structured data from day one.
 */

import { useState } from "react";
import type { SubmitEventHandler } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiSubmitFeedback } from "../api/client";

function Feedback() {
  const [searchParams] = useSearchParams();

  // Pre-filled from query params when coming from a provider profile
  // use `as const` on the preType ternary so that TypeScript doesn't widen
  // to `string`. Prevents `useState` generic from widening later too.
  const preType = searchParams.get("type") === "REPORT_ISSUE"
    ? "REPORT_ISSUE" as const
    : "GENERAL_FEEDBACK" as const;
  const preProviderId = searchParams.get("provider_id") || null;
  const preProviderName = searchParams.get("provider_name") || null;

  const [feedbackType, setFeedbackType] = useState<"REPORT_ISSUE" | "GENERAL_FEEDBACK">(preType);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReport = feedbackType === "REPORT_ISSUE";

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();  // prevents double-submission from a fast Enter key (suspenders)
    setError(null);

    if (!message.trim()) {
      setError("Please describe the issue or feedback.");
      return;
    }

    setSubmitting(true);
    try {
      await apiSubmitFeedback({
        type: feedbackType,
        message: message.trim(),
        provider_id: isReport ? preProviderId : null,
        reporter_email: email.trim() || null,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──
  if (submitted) {
    return (
      <div className="feedback-page">
        <div className="feedback-success">
          <h1>Thank you!</h1>
          <p>
            {isReport
              ? "We've received your report and will look into it."
              : "Your feedback helps us make FindMyHygienist better for everyone."}
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="feedback-page">
      <h1>{isReport ? "Report an Issue" : "Give Us Feedback"}</h1>

      {/* TODO: provider_name comes from the query string — user-controlled text.
          Not an XSS risk (React escapes it), but someone could craft a silly URL.
          Post-conference: fetch the display name from the API using provider_id
          instead of trusting the query param. — Phase 2 */}
      {isReport && preProviderName && (
        <p className="feedback-context">
          Reporting an issue with <strong>{preProviderName}</strong>'s listing.
        </p>
      )}

      {!isReport && (
        <p className="feedback-context">
          Something broken? Something confusing? Something you wish we had?
          We're building this for Oregon's hygienists and the patients who need
          them — your feedback shapes what comes next.
        </p>
      )}

      <form onSubmit={handleSubmit} className="feedback-form">
        {/* Type toggle — only show if not pre-set from a profile link */}
        {!preProviderId && (
          <div className="feedback-field">
            <label htmlFor="feedback-type">What kind of feedback?</label>
            <select
              id="feedback-type"
              value={feedbackType}
              onChange={(e) => setFeedbackType(e.target.value as "REPORT_ISSUE" | "GENERAL_FEEDBACK")}
            >
              <option value="GENERAL_FEEDBACK">General feedback</option>
              <option value="REPORT_ISSUE">Report an issue with a listing</option>
            </select>
          </div>
        )}

        <div className="feedback-field">
          <label htmlFor="feedback-message">
            {isReport ? "What's wrong with this listing?" : "What's on your mind?"}
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={10000}
            placeholder={
              isReport
                ? "Incorrect info, outdated details, something that doesn't look right…"
                : "Ideas, bugs, things that confused you, things you liked…"
            }
            /*required - handleSubmit already validates and shows a custom error, we don't want a tooltip as well*/
          />
          <span className="feedback-char-count">
            {message.length.toLocaleString()} / 10,000
          </span>
        </div>

        <div className="feedback-field">
          <label htmlFor="feedback-email">
            Your email <span className="feedback-optional">(optional)</span>
          </label>
          {/* TODO: Email-or-not design decisions to revisit post-conference:
            - If a logged-in provider submits feedback, should we pre-fill their
              email from their profile? Convenient but signals "we know who you are"
              which may chill honest feedback. Probably offer, don't force.
            - Add a checkbox: "I'd like a response" — only show email field when
              checked. Clearer intent, and we only store email when they explicitly
              want contact. Also makes the "anonymous by default" promise visible.
            - If we add a response workflow later, the email here is the reply-to
              address, not an identity lookup. Don't cross-reference it with the
              users table without explicit consent. submitted_by_user_id already
              handles identity separately.
            — Phase 2 */}
          <input
            id="feedback-email"
            /*type="email" - you could make the browser enforce email format, but backend deliberately accepts any string*/
            /*type="text" inputMode="email" - mobile @ keyboard, no validation*/
            /*DECISION: The field is labeled "email," you might want to reply to it, 
            and the browser validation is a kindness, not a restriction*/
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Only if you'd like us to follow up"
          />
        </div>

        {error && <p className="feedback-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting} /*prevents double-submission from a fast Enter key (belt)*/
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
      </form>
    </div>
  );
}

export default Feedback;
