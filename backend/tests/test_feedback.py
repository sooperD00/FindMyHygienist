"""
Sprint 14 feedback tests — no database required.

Verifies request/response schema validation, FeedbackType enum
coverage, message length constraints, and Feedback model defaults.
Route-level flows (actual DB insert) are smoke-tested via Swagger.

Run with:
    cd backend && pytest tests/test_feedback.py -v
"""

import uuid

import pytest
from pydantic import ValidationError

from app.models.enums import FeedbackType
from app.models.feedback import Feedback
from app.routes.feedback import FeedbackRequest, FeedbackResponse


# ── FeedbackType enum ─────────────────────────────────────────────


class TestFeedbackType:
    """FeedbackType enum completeness and string values."""

    def test_has_report_issue(self):
        assert FeedbackType.REPORT_ISSUE == "REPORT_ISSUE"

    def test_has_general_feedback(self):
        assert FeedbackType.GENERAL_FEEDBACK == "GENERAL_FEEDBACK"

    def test_exactly_two_members(self):
        assert len(FeedbackType) == 2


# ── FeedbackRequest schema ────────────────────────────────────────


class TestFeedbackRequest:
    """Pydantic validation on the inbound request body."""

    def test_minimal_report_issue(self):
        req = FeedbackRequest(type="REPORT_ISSUE", message="Something is wrong")
        assert req.type == FeedbackType.REPORT_ISSUE
        assert req.message == "Something is wrong"
        assert req.provider_id is None
        assert req.reporter_email is None

    def test_minimal_general_feedback(self):
        req = FeedbackRequest(type="GENERAL_FEEDBACK", message="Great site!")
        assert req.type == FeedbackType.GENERAL_FEEDBACK

    def test_with_all_optional_fields(self):
        pid = str(uuid.uuid4())
        req = FeedbackRequest(
            type="REPORT_ISSUE",
            message="Wrong address listed",
            provider_id=pid,
            reporter_email="user@example.com",
        )
        assert req.provider_id == pid
        assert req.reporter_email == "user@example.com"

    def test_invalid_type_rejected(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(type="INVALID", message="test")

    def test_missing_message_rejected(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(type="GENERAL_FEEDBACK")  # type: ignore[call-arg]

    def test_missing_type_rejected(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(message="test")  # type: ignore[call-arg]


# ── FeedbackResponse schema ───────────────────────────────────────


class TestFeedbackResponse:
    """Response shape matches what the frontend expects."""

    def test_response_fields(self):
        resp = FeedbackResponse(
            id=str(uuid.uuid4()),
            type=FeedbackType.GENERAL_FEEDBACK,
            message="test",
            provider_id=None,
        )
        assert resp.provider_id is None
        assert resp.type == FeedbackType.GENERAL_FEEDBACK

    def test_response_with_provider_id(self):
        pid = str(uuid.uuid4())
        resp = FeedbackResponse(
            id=str(uuid.uuid4()),
            type=FeedbackType.REPORT_ISSUE,
            message="bad listing",
            provider_id=pid,
        )
        assert resp.provider_id == pid


# ── Feedback model defaults ───────────────────────────────────────


class TestFeedbackModel:
    """Feedback SQLModel defaults (no DB — just object creation)."""

    def test_default_resolved_false(self):
        fb = Feedback(type=FeedbackType.REPORT_ISSUE, message="test")
        assert fb.resolved is False

    def test_default_id_generated(self):
        fb = Feedback(type=FeedbackType.GENERAL_FEEDBACK, message="test")
        assert fb.id is not None
        assert isinstance(fb.id, uuid.UUID)

    def test_provider_id_nullable(self):
        fb = Feedback(type=FeedbackType.GENERAL_FEEDBACK, message="test")
        assert fb.provider_id is None

    def test_reporter_email_nullable(self):
        fb = Feedback(type=FeedbackType.REPORT_ISSUE, message="test")
        assert fb.reporter_email is None


    """ Feedback by authenticated user  """

    # prove the new columns default correctly and accept values. 
    # Same pattern you already have for resolved, provider_id, and reporter_email

    def test_default_is_authenticated_false(self):
        fb = Feedback(type=FeedbackType.GENERAL_FEEDBACK, message="test")
        assert fb.is_authenticated is False

    def test_default_submitted_by_user_id_none(self):
        fb = Feedback(type=FeedbackType.GENERAL_FEEDBACK, message="test")
        assert fb.submitted_by_user_id is None

    def test_authenticated_feedback(self):
        user_id = uuid.uuid4()
        fb = Feedback(
            type=FeedbackType.REPORT_ISSUE,
            message="test",
            is_authenticated=True,
            submitted_by_user_id=user_id,
        )
        assert fb.is_authenticated is True
        assert fb.submitted_by_user_id == user_id