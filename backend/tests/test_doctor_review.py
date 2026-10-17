
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from models import ClinicalSummary, IntakeSession
from routers.doctor import review_doctor_session
from schemas import ClinicalSummaryReview


def make_test_setup(
    current_status="pending",
    session_exists=True,
    summary_exists=True,
):
    """Create mocked database records without connecting to PostgreSQL."""
    db = MagicMock()

    session_record = SimpleNamespace(id=10)
    summary_record = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary="Test clinical summary",
        review_status=current_status,
        doctor_notes=None,
        created_at=datetime(2026, 10, 1),
        updated_at=None,
    )

    session_query = MagicMock()
    session_query.join.return_value = session_query
    session_query.filter.return_value = session_query
    session_query.first.return_value = (
        session_record if session_exists else None
    )

    summary_query = MagicMock()
    summary_query.filter.return_value = summary_query
    summary_query.first.return_value = (
        summary_record if summary_exists else None
    )

    def query_for_model(model):
        if model is IntakeSession:
            return session_query
        if model is ClinicalSummary:
            return summary_query
        raise AssertionError(f"Unexpected model queried: {model}")

    db.query.side_effect = query_for_model

    doctor = SimpleNamespace(
        id=5,
        role="doctor",
        tenant_id=1,
    )

    return db, doctor, summary_record


def test_pending_summary_can_be_marked_reviewed():
    db, doctor, summary = make_test_setup()

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Reviewed the patient intake information.",
    )

    result = review_doctor_session(
        session_id=10,
        review_data=request,
        current_user=doctor,
        db=db,
    )

    assert result["review_status"] == "reviewed"
    assert result["doctor_notes"] == (
        "Reviewed the patient intake information."
    )
    assert summary.review_status == "reviewed"
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(summary)


def test_blank_notes_are_rejected_for_reviewed_status():
    db, doctor, summary = make_test_setup()

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="   ",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_doctor_session(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 422
    assert summary.review_status == "pending"
    db.commit.assert_not_called()
    db.rollback.assert_called_once()


def test_blank_notes_are_rejected_for_approved_status():
    db, doctor, summary = make_test_setup()

    request = ClinicalSummaryReview(
        review_status="approved",
        doctor_notes=" ",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_doctor_session(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 422
    assert summary.review_status == "pending"
    db.commit.assert_not_called()


def test_approved_summary_cannot_return_to_reviewed():
    db, doctor, summary = make_test_setup(
        current_status="approved",
    )

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Trying an invalid status change.",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_doctor_session(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 409
    assert summary.review_status == "approved"
    db.commit.assert_not_called()


def test_unassigned_or_inaccessible_session_returns_404():
    db, doctor, _ = make_test_setup(
        session_exists=False,
    )

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Reviewed the intake information.",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_doctor_session(
            session_id=999,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 404
    db.commit.assert_not_called()


def test_missing_clinical_summary_returns_404():
    db, doctor, _ = make_test_setup(
        summary_exists=False,
    )

    request = ClinicalSummaryReview(
        review_status="reviewed",
        doctor_notes="Reviewed the intake information.",
    )

    with pytest.raises(HTTPException) as exc_info:
        review_doctor_session(
            session_id=10,
            review_data=request,
            current_user=doctor,
            db=db,
        )

    assert exc_info.value.status_code == 404
    db.commit.assert_not_called()
