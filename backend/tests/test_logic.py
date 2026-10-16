
from datetime import date

from services.intake_logic import (
    calculate_progress,
    is_intake_complete,
    can_change_status,
    calculate_age,
    get_answer_category,
)


def test_progress():
    assert calculate_progress(3, 7) == 43
    assert calculate_progress(0, 0) == 0
    assert calculate_progress(7, 7) == 100


def test_intake_completion():
    assert is_intake_complete("Headache", "2 days")
    assert not is_intake_complete("", "2 days")
    assert not is_intake_complete("Headache", "")


def test_status_rules():
    assert can_change_status("pending", "reviewed")
    assert can_change_status("pending", "approved")
    assert can_change_status("reviewed", "approved")
    assert not can_change_status("approved", "pending")
    assert not can_change_status("reviewed", "pending")


def test_calculate_age():
    assert calculate_age(
        date(2000, 10, 14),
        date(2026, 10, 14),
    ) == 26

    assert calculate_age(
        date(2000, 10, 15),
        date(2026, 10, 14),
    ) == 25


def test_future_birth_date():
    try:
        calculate_age(date(2030, 1, 1), date(2026, 10, 14))
        assert False, "Expected ValueError for future birth date"
    except ValueError as exc:
        assert "future" in str(exc)


def test_answer_categories():
    assert get_answer_category("symptom") == "symptoms"
    assert get_answer_category("medications") == "medications"
    assert get_answer_category("medical_history") == "medical_history"
    assert get_answer_category("allergies") == "allergies"
    assert get_answer_category("unknown") is None
