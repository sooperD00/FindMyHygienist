"""
Feedback endpoint: submit feedback or report an issue.

No auth required — anonymous visitors can submit. Two entry points
on the frontend resolve to the same POST:
  1. "Report an issue" on a provider profile → type=REPORT_ISSUE, provider_id set
  2. "Give us feedback" in the site footer    → type=GENERAL_FEEDBACK, no provider_id

The Feedback model and table already exist (Sprint 1 migration).
No admin UI yet — query the table directly or build a view later.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.enums import FeedbackType
from app.models.feedback import Feedback
from app.dependencies import get_current_user_or_none
from app.models.user import User

router = APIRouter(prefix="/api", tags=["feedback"])


# ── Request / Response schemas ────────────────────────────────────

class FeedbackRequest(BaseModel):
    type: FeedbackType
    message: str
    provider_id: str | None = None
    reporter_email: str | None = None  # not EmailStr — let people type what they want, validate later if needed


class FeedbackResponse(BaseModel):
    id: str
    type: FeedbackType
    message: str
    provider_id: str | None


# ── Endpoint ──────────────────────────────────────────────────────

@router.post("/feedback", response_model=FeedbackResponse, status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user_or_none),
):
    """Accept feedback or an issue report. No auth required.

    Validates message length (DB constraint: ≤10,000 chars) and
    feedback type. Stores in the feedback table for later review.
    """
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=422, detail="Message cannot be empty")

    if len(body.message) > 10_000:
        raise HTTPException(status_code=422, detail="Message must be 10,000 characters or fewer")

    feedback = Feedback(
        type=body.type,
        message=body.message.strip(),
        provider_id=body.provider_id,
        reporter_email=body.reporter_email.strip() if body.reporter_email else None,
        is_authenticated=current_user is not None,
        submitted_by_user_id=current_user.id if current_user else None,
    )

    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(
        id=str(feedback.id),
        type=feedback.type,
        message=feedback.message,
        provider_id=str(feedback.provider_id) if feedback.provider_id else None,
    )
