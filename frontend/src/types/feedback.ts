/**
 * Feedback types — mirrors the Pydantic response models in routes/feedback.py.
 *
 */


export interface FeedbackRequest {
  type: "REPORT_ISSUE" | "GENERAL_FEEDBACK";
  message: string;
  provider_id?: string | null;
  reporter_email?: string | null;
}

export interface FeedbackResponse {
  id: string;
  type: "REPORT_ISSUE" | "GENERAL_FEEDBACK";
  message: string;
  provider_id: string | null;
}