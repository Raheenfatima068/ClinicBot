
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from routers.ai import review_session_summary
from schemas import ClinicalSummaryReview


def make_ai_review_setup(current_status="pending"):
    """Build test objects without accessing the real database."""
    db = MagicMock()

    doctor = SimpleNamespace(
        id=5,
        role="doctor",
        tenant_id=1,
    )

    summary = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary="Test SOAP summary",
        review_status=current_status,
        doctor_notes=None,
        created_at=datetime(2026, 10, 1),
        updated_at=None,
    )

    return db, doctor, summary


@patch("routers.ai.get_saved_summary")
@patch("routers.ai.get_doctor_session")
def test_ai_summary_can_be_marked_reviewed(
    mock_get_session,
    mock_get_summary,
):
    db, doctor, summary = make_ai_review_setup()
    mock_get_summary.return_value = summary

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Reviewed the SOAP summary.",
    )

    result = review_session_summary(
        session_id=10,
        review_data=request,
        current_user=doctor,
        db=db,
    )

    mock_get_session.assert_called_once_with(10, doctor, db)
    mock_get_summary.assert_called_once_with(10, db)
    assert result["review_status"] == "reviewed"
    assert result["doctor_notes"] == "Reviewed the SOAP summary."
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(summary)


@pytest.mark.parametrize("new_status", ["reviewed", "approved"])
@patch("routers.ai.get_saved_summary")
@patch("routers.ai.get_doctor_session")
def test_ai_summary_rejects_blank_notes(
    mock_get_session,
    mock_get_summary,
    new_status,
):
    db, doctor, summary = make_ai_review_setup()
    mock_get_summary.return_value = summary

    request = ClinicalSummaryReview(
        review_status=new_status,
        doctor_notes="   ",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_session_summary(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 422
    assert summary.review_status == "pending"
    db.commit.assert_not_called()


@patch("routers.ai.get_saved_summary")
@patch("routers.ai.get_doctor_session")
def test_ai_summary_rejects_approved_to_reviewed(
    mock_get_session,
    mock_get_summary,
):
    db, doctor, summary = make_ai_review_setup(
        current_status="approved",
    )
    mock_get_summary.return_value = summary

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Attempting an invalid transition.",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_session_summary(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 409
    assert summary.review_status == "approved"
    db.commit.assert_not_called()


@patch("routers.ai.get_doctor_session")
def test_ai_summary_rejects_unauthorized_session(
    mock_get_session,
):
    db, doctor, _ = make_ai_review_setup()

    mock_get_session.side_effect = HTTPException(
        status_code=404,
        detail="Intake session not found.",
    )

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Reviewed the SOAP summary.",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_session_summary(
            session_id=999,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 404
    db.commit.assert_not_called()
