
from datetime import date


ALLOWED_TRANSITIONS = {
    "pending": {"reviewed", "approved"},
    "reviewed": {"approved"},
    "approved": set(),
}


ANSWER_CATEGORIES = {
    "symptom": "symptoms",
    "symptoms": "symptoms",
    "medication": "medications",
    "medications": "medications",
    "medical_history": "medical_history",
    "history": "medical_history",
    "allergy": "allergies",
    "allergies": "allergies",
}


def calculate_progress(answered: int, total: int) -> int:
    """Calculate intake completion percentage."""
    if total <= 0:
        return 0

    answered = max(0, min(answered, total))
    return round(answered / total * 100)


def is_intake_complete(
    chief_complaint: str | None,
    symptom_duration: str | None,
) -> bool:
    """Check whether the minimum intake information is available."""
    return bool(
        chief_complaint and chief_complaint.strip()
        and symptom_duration and symptom_duration.strip()
    )


def can_change_status(current: str, new: str) -> bool:
    """Check whether a review-status transition is allowed."""
    return new in ALLOWED_TRANSITIONS.get(current, set())


def calculate_age(date_of_birth: date, today: date | None = None) -> int:
    """Calculate age from date of birth."""
    if today is None:
        today = date.today()

    if date_of_birth > today:
        raise ValueError("Date of birth cannot be in the future.")

    return (
        today.year
        - date_of_birth.year
        - (
            (today.month, today.day)
            < (date_of_birth.month, date_of_birth.day)
        )
    )


def get_answer_category(field: str) -> str | None:
    """Map an intake field to its database category."""
    return ANSWER_CATEGORIES.get(field.strip().lower())
