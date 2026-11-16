
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import BackgroundTasks

from routers import ai


# ==================================================
# BACKGROUND GENERATION TEST SETUP
# ==================================================

def make_background_setup():
    """Create fake database records for background generation."""

    clinical_summary = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary="Old summary",
        generation_status="pending",
        review_status="reviewed",
        doctor_notes="Old doctor notes",
    )

    intake_session = SimpleNamespace(
        id=10,
        chief_complaint="Headache",
        symptom_duration="2 days",
    )

    symptoms = [
        SimpleNamespace(symptom_name="Headache"),
        SimpleNamespace(symptom_name="Dizziness"),
    ]

    medical_history = [
        SimpleNamespace(condition_name="Asthma"),
    ]

    medications = [
        SimpleNamespace(medication_name="None"),
    ]

    allergies = [
        SimpleNamespace(allergen="None reported"),
    ]

    records = {
        ai.ClinicalSummary: [clinical_summary],
        ai.IntakeSession: [intake_session],
        ai.Symptom: symptoms,
        ai.MedicalHistory: medical_history,
        ai.Medication: medications,
        ai.Allergy: allergies,
    }

    class FakeQuery:
        def __init__(self, model):
            self.model = model

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return records[self.model][0] if records[self.model] else None

        def all(self):
            return records[self.model]

    db = Mock()
    db.query.side_effect = lambda model: FakeQuery(model)

    return db, records, clinical_summary


# ==================================================
# BACKGROUND GENERATION TESTS
# ==================================================

def test_background_generation_saves_successful_summary(monkeypatch):
    db, records, summary = make_background_setup()

    monkeypatch.setattr(ai, "SessionLocal", lambda: db)

    generate_mock = Mock(
        return_value=(
            "AI-GENERATED DRAFT - REQUIRES DOCTOR REVIEW\n"
            "Subjective: Patient reports headache for two days."
        )
    )

    monkeypatch.setattr(ai, "generate_soap_summary", generate_mock)

    ai.generate_summary_in_background(10, 20)

    assert summary.generation_status == "completed"
    assert summary.review_status == "pending"
    assert summary.doctor_notes is None
    assert "Patient reports headache" in summary.summary

    generate_mock.assert_called_once_with(
        chief_complaint="Headache",
        symptom_duration="2 days",
        symptoms=["Headache", "Dizziness"],
        medical_history=["Asthma"],
        medications=["None"],
        allergies=["None reported"],
    )

    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_background_generation_saves_fallback_as_completed(monkeypatch):
    db, records, summary = make_background_setup()

    monkeypatch.setattr(ai, "SessionLocal", lambda: db)

    fallback = (
        "AI SUMMARY UNAVAILABLE - FALLBACK DRAFT\n"
        "Patient reports headache for two days."
    )

    monkeypatch.setattr(
        ai,
        "generate_soap_summary",
        lambda **kwargs: fallback,
    )

    ai.generate_summary_in_background(10, 20)

    assert summary.generation_status == "completed"
    assert summary.review_status == "pending"
    assert ai.is_fallback_summary(summary.summary) is True

    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_background_generation_marks_failure_when_service_raises(
    monkeypatch,
):
    db, records, summary = make_background_setup()

    monkeypatch.setattr(ai, "SessionLocal", lambda: db)

    monkeypatch.setattr(
        ai,
        "generate_soap_summary",
        Mock(side_effect=RuntimeError("Gemini service failed")),
    )

    ai.generate_summary_in_background(10, 20)

    assert summary.generation_status == "failed"
    assert summary.summary == ai.FAILED_SUMMARY_TEXT
    assert summary.review_status == "pending"
    assert summary.doctor_notes is None

    db.rollback.assert_called_once()
    assert db.commit.call_count == 1
    db.close.assert_called_once()


def test_background_generation_handles_missing_intake_session(
    monkeypatch,
):
    db, records, summary = make_background_setup()

    records[ai.IntakeSession] = []

    monkeypatch.setattr(ai, "SessionLocal", lambda: db)

    generate_mock = Mock()
    monkeypatch.setattr(ai, "generate_soap_summary", generate_mock)

    ai.generate_summary_in_background(10, 20)

    assert summary.generation_status == "failed"
    assert summary.summary == ai.FAILED_SUMMARY_TEXT

    generate_mock.assert_not_called()
    db.commit.assert_called_once()
    db.close.assert_called_once()


def test_background_generation_handles_missing_clinical_summary(
    monkeypatch,
):
    db, records, summary = make_background_setup()

    records[ai.ClinicalSummary] = []

    monkeypatch.setattr(ai, "SessionLocal", lambda: db)

    generate_mock = Mock()
    monkeypatch.setattr(ai, "generate_soap_summary", generate_mock)

    ai.generate_summary_in_background(10, 20)

    generate_mock.assert_not_called()
    db.commit.assert_not_called()
    db.close.assert_called_once()


# ==================================================
# ENDPOINT TEST SETUP
# ==================================================

def make_endpoint_setup(summary):
    """Create mocked dependencies for the generation endpoint."""

    db = Mock()
    query = db.query.return_value
    query.filter.return_value.first.return_value = summary

    patient = SimpleNamespace(
        id=3,
        role="patient",
        tenant_id=1,
    )

    background_tasks = BackgroundTasks()

    return db, patient, background_tasks


# ==================================================
# DUPLICATE PREVENTION AND RETRY TESTS
# ==================================================

def test_pending_summary_does_not_schedule_duplicate_task(monkeypatch):
    summary = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary="Generation in progress",
        generation_status="pending",
        review_status="pending",
        doctor_notes=None,
        created_at=None,
        updated_at=None,
    )

    db, patient, background_tasks = make_endpoint_setup(summary)

    monkeypatch.setattr(ai, "get_patient_session", Mock())

    monkeypatch.setattr(
        ai,
        "summary_response",
        lambda session_id, item: {
            "session_id": session_id,
            "generation_status": item.generation_status,
        },
    )

    result = ai.generate_session_summary(
        session_id=10,
        background_tasks=background_tasks,
        current_user=patient,
        db=db,
    )

    assert result["generation_status"] == "pending"
    assert "already in progress" in result["message"]
    assert len(background_tasks.tasks) == 0

    db.commit.assert_not_called()


def test_failed_summary_can_be_retried(monkeypatch):
    summary = SimpleNamespace(
        id=20,
        intake_session_id=10,
        summary="Previous generation failed",
        generation_status="failed",
        review_status="reviewed",
        doctor_notes="Previous doctor notes",
        created_at=None,
        updated_at=None,
    )

    db, patient, background_tasks = make_endpoint_setup(summary)

    monkeypatch.setattr(ai, "get_patient_session", Mock())

    monkeypatch.setattr(
        ai,
        "summary_response",
        lambda session_id, item: {
            "session_id": session_id,
            "summary_id": item.id,
            "generation_status": item.generation_status,
            "review_status": item.review_status,
        },
    )

    result = ai.generate_session_summary(
        session_id=10,
        background_tasks=background_tasks,
        current_user=patient,
        db=db,
    )

    assert summary.generation_status == "pending"
    assert summary.review_status == "pending"
    assert summary.doctor_notes is None
    assert summary.summary == ai.PENDING_SUMMARY_TEXT

    assert result["generation_status"] == "pending"
    assert "generation started" in result["message"].lower()

    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(summary)

    assert len(background_tasks.tasks) == 1

    task = background_tasks.tasks[0]
    assert task.func == ai.generate_summary_in_background
    assert task.args == (10, 20)
