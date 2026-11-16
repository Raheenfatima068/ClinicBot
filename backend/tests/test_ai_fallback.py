
from datetime import datetime
from types import SimpleNamespace

from routers.ai import is_fallback_summary, summary_response


def test_ascii_fallback_heading_is_detected():
    summary = (
        "AI SUMMARY UNAVAILABLE - FALLBACK DRAFT\n"
        "Patient reports headache for two days."
    )

    assert is_fallback_summary(summary) is True


def test_fallback_summary_is_not_reported_as_ai_generated():
    session = SimpleNamespace(id=10)

    summary = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary=(
            "AI SUMMARY UNAVAILABLE - FALLBACK DRAFT\n"
            "Patient reports headache for two days."
        ),
        generation_status="completed",
        review_status="pending",
        doctor_notes=None,
        created_at=datetime(2026, 10, 1),
        updated_at=None,
    )

    result = summary_response(session, summary)

    assert result["generation_status"] == "completed"
    assert result["ai_generated"] is False
    assert result["fallback_used"] is True
