import logging
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import (
    User,
    IntakeSession,
    Symptom,
    MedicalHistory,
    Medication,
    Allergy,
    ClinicalSummary,
    PatientProfile,
)
from dependencies import get_current_user
from schemas import ClinicalSummaryReview
from services.gemini_service import generate_soap_summary
from services.intake_logic import can_change_status

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai",
    tags=["AI Summary"],
)

FALLBACK_MARKERS = (
    "AI SUMMARY UNAVAILABLE — FALLBACK DRAFT",
    # Accept the mojibake form used by some older service-file encodings.
    "AI SUMMARY UNAVAILABLE â€” FALLBACK DRAFT",
)
PENDING_SUMMARY_TEXT = (
    "Summary generation is in progress. This placeholder is not a clinical summary."
)
FAILED_SUMMARY_TEXT = (
    "Summary generation failed. Please retry generation. This is not a clinical summary."
)


# --------------------------------------------------
# SOAP SUMMARY FORMATTING
# --------------------------------------------------

def clean_soap_summary(summary: str | None) -> str:
    """Clean escaped Markdown and excessive whitespace."""
    if not summary:
        return ""

    summary = summary.strip()
    summary = summary.replace(r"\*\*", "**")
    summary = summary.replace(r"\*", "*")
    summary = summary.replace(r"\_", "_")
    summary = re.sub(r"[ \t]+\n", "\n", summary)
    summary = re.sub(r"\n{3,}", "\n\n", summary)
    return summary.strip()


def is_fallback_summary(summary: str | None) -> bool:
    """Identify a fallback draft returned by the Gemini service."""
    if not summary:
        return False
    normalized = summary.lstrip()
    return any(normalized.startswith(marker) for marker in FALLBACK_MARKERS)


# --------------------------------------------------
# CLINIC / TENANT VALIDATION
# --------------------------------------------------

def require_clinic_assignment(current_user: User):
    """Ensure the authenticated user belongs to a clinic."""
    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a clinic.",
        )


# --------------------------------------------------
# PATIENT SESSION AUTHORIZATION
# --------------------------------------------------

def get_patient_session(
    session_id: int,
    current_user: User,
    db: Session,
):
    """Return an intake session belonging to this patient."""
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Patient access required.",
        )

    require_clinic_assignment(current_user)

    session = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(user_id=current_user.id),
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    patient = session.patient
    if (
        patient is None
        or patient.user is None
        or patient.user.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    return session


# --------------------------------------------------
# DOCTOR SESSION AUTHORIZATION
# --------------------------------------------------

def get_doctor_session(
    session_id: int,
    current_user: User,
    db: Session,
):
    """Return a session assigned to this doctor in their clinic."""
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Doctor access required.",
        )

    require_clinic_assignment(current_user)

    session = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.assigned_doctor_id == current_user.id,
            IntakeSession.patient.has(
                PatientProfile.user.has(
                    User.tenant_id == current_user.tenant_id
                )
            ),
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    patient = session.patient
    if (
        patient is None
        or patient.user is None
        or patient.user.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    return session


# --------------------------------------------------
# SAVED SUMMARY LOOKUP / RESPONSE
# --------------------------------------------------

def get_saved_summary(session_id: int, db: Session):
    """Find the saved clinical summary for an intake session."""
    summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.intake_session_id == session_id)
        .first()
    )

    if summary is None:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found.",
        )

    return summary


def summary_response(session_id: int, summary: ClinicalSummary):
    """Return a consistent response for SOAP summary endpoints."""
    summary_text = summary.summary or ""
    fallback_used = is_fallback_summary(summary_text)
    generation_status = getattr(summary, "generation_status", "completed")

    return {
        "session_id": session_id,
        "summary_id": summary.id,
        "generation_status": generation_status,
        "review_status": summary.review_status,
        "summary": summary_text,
        "doctor_notes": summary.doctor_notes,
        "created_at": summary.created_at,
        "updated_at": summary.updated_at,
        "ai_generated": generation_status == "completed" and not fallback_used,
        "fallback_used": fallback_used,
    }


# --------------------------------------------------
# BACKGROUND GENERATION TASK
# --------------------------------------------------

def generate_summary_in_background(session_id: int, summary_id: int) -> None:
    """Generate and persist a draft using a task-owned database session.

    FastAPI BackgroundTasks runs in this application process. For this project
    prototype, the task creates its own SQLAlchemy session rather than using the
    request-scoped database session.
    """
    db = SessionLocal()
    try:
        clinical_summary = (
            db.query(ClinicalSummary)
            .filter(
                ClinicalSummary.id == summary_id,
                ClinicalSummary.intake_session_id == session_id,
            )
            .first()
        )
        intake_session = (
            db.query(IntakeSession)
            .filter(IntakeSession.id == session_id)
            .first()
        )

        if clinical_summary is None or intake_session is None:
            logger.error(
                "Background summary task could not find records for session %s.",
                session_id,
            )
            if clinical_summary is not None:
                clinical_summary.generation_status = "failed"
                clinical_summary.summary = FAILED_SUMMARY_TEXT
                db.commit()
            return

        symptoms = (
            db.query(Symptom)
            .filter(Symptom.intake_session_id == session_id)
            .all()
        )
        medical_history = (
            db.query(MedicalHistory)
            .filter(MedicalHistory.intake_session_id == session_id)
            .all()
        )
        medications = (
            db.query(Medication)
            .filter(Medication.intake_session_id == session_id)
            .all()
        )
        allergies = (
            db.query(Allergy)
            .filter(Allergy.intake_session_id == session_id)
            .all()
        )

        raw_summary = generate_soap_summary(
            chief_complaint=intake_session.chief_complaint or "Not provided",
            symptom_duration=intake_session.symptom_duration or "Not provided",
            symptoms=[item.symptom_name for item in symptoms],
            medical_history=[item.condition_name for item in medical_history],
            medications=[item.medication_name for item in medications],
            allergies=[item.allergen for item in allergies],
        )
        summary_text = clean_soap_summary(raw_summary)

        if not summary_text:
            raise ValueError("Summary service returned an empty result.")

        # The service may return a fallback draft when Gemini is unavailable.
        # That is a completed generation task, but ai_generated remains False.
        clinical_summary.summary = summary_text
        clinical_summary.generation_status = "completed"
        # Every newly generated draft must be reviewed again.
        clinical_summary.review_status = "pending"
        clinical_summary.doctor_notes = None
        db.commit()

        logger.info(
            "Summary generation finished for session %s (fallback=%s).",
            session_id,
            is_fallback_summary(summary_text),
        )

    except Exception:
        db.rollback()
        logger.exception(
            "Background summary generation failed for session %s.",
            session_id,
        )
        try:
            clinical_summary = (
                db.query(ClinicalSummary)
                .filter(
                    ClinicalSummary.id == summary_id,
                    ClinicalSummary.intake_session_id == session_id,
                )
                .first()
            )
            if clinical_summary is not None:
                clinical_summary.generation_status = "failed"
                clinical_summary.summary = FAILED_SUMMARY_TEXT
                clinical_summary.review_status = "pending"
                clinical_summary.doctor_notes = None
                db.commit()
        except Exception:
            db.rollback()
            logger.exception(
                "Unable to persist failed generation status for session %s.",
                session_id,
            )
    finally:
        db.close()


# --------------------------------------------------
# REQUEST SOAP SUMMARY GENERATION
# POST /ai/sessions/{session_id}/soap-summary
# PATIENT ONLY
# --------------------------------------------------

@router.post("/sessions/{session_id}/soap-summary")
def generate_session_summary(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(ClinicalSummary.intake_session_id == session_id)
        .first()
    )

    # Avoid queueing duplicate work when a task is already marked pending.
    if clinical_summary is not None and clinical_summary.generation_status == "pending":
        result = summary_response(session_id, clinical_summary)
        result["message"] = "Summary generation is already in progress. Poll the GET endpoint for status."
        return result

    try:
        if clinical_summary is None:
            clinical_summary = ClinicalSummary(
                intake_session_id=session_id,
                summary=PENDING_SUMMARY_TEXT,
                review_status="pending",
                generation_status="pending",
                doctor_notes=None,
            )
            db.add(clinical_summary)
            db.flush()
        else:
            # Do not leave an old approved draft visible as the current draft.
            clinical_summary.summary = PENDING_SUMMARY_TEXT
            clinical_summary.generation_status = "pending"
            clinical_summary.review_status = "pending"
            clinical_summary.doctor_notes = None

        db.commit()
        db.refresh(clinical_summary)

    except Exception:
        db.rollback()
        logger.exception(
            "Unable to queue summary generation for session %s.",
            session_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to start clinical summary generation.",
        )

    # Pass only identifiers; the background task opens its own DB session.
    background_tasks.add_task(
        generate_summary_in_background,
        session_id,
        clinical_summary.id,
    )

    result = summary_response(session_id, clinical_summary)
    result["message"] = "Summary generation started. Poll the GET endpoint for status."
    return result


# --------------------------------------------------
# GET PATIENT'S OWN SOAP SUMMARY
# GET /ai/sessions/{session_id}/soap-summary
# PATIENT ONLY
# --------------------------------------------------

@router.get("/sessions/{session_id}/soap-summary")
def get_saved_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)
    clinical_summary = get_saved_summary(session_id, db)

    cleaned_summary = clean_soap_summary(clinical_summary.summary or "")
    if cleaned_summary != clinical_summary.summary:
        try:
            clinical_summary.summary = cleaned_summary
            db.commit()
            db.refresh(clinical_summary)
        except Exception:
            db.rollback()
            logger.exception(
                "Unable to clean summary for session %s.",
                session_id,
            )
            raise HTTPException(
                status_code=500,
                detail="Unable to update clinical summary formatting.",
            )

    result = summary_response(session_id, clinical_summary)
    if result["generation_status"] == "pending":
        result["message"] = "Summary generation is in progress. Refresh this endpoint shortly."
    elif result["generation_status"] == "failed":
        result["message"] = "Summary generation failed. Submit a new POST request to retry."
    elif result["fallback_used"]:
        result["message"] = "A fallback draft was saved because Gemini was unavailable. Doctor review is required."
    return result


# --------------------------------------------------
# GET DOCTOR'S ASSIGNED SOAP SUMMARY
# GET /ai/sessions/{session_id}/doctor-soap-summary
# ASSIGNED DOCTOR IN THE SAME CLINIC ONLY
# --------------------------------------------------

@router.get("/sessions/{session_id}/doctor-soap-summary")
def get_doctor_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_doctor_session(session_id, current_user, db)
    clinical_summary = get_saved_summary(session_id, db)
    result = summary_response(session_id, clinical_summary)
    if result["generation_status"] == "pending":
        result["message"] = "Summary generation is in progress. Refresh shortly."
    elif result["generation_status"] == "failed":
        result["message"] = "Summary generation failed; the patient can retry generation."
    elif result["fallback_used"]:
        result["message"] = "This is a fallback draft, not a Gemini-generated summary. Doctor review is required."
    return result


# --------------------------------------------------
# REVIEW SOAP SUMMARY
# PUT /ai/sessions/{session_id}/soap-summary/review
# ASSIGNED DOCTOR IN THE SAME CLINIC ONLY
# --------------------------------------------------

@router.put("/sessions/{session_id}/soap-summary/review")
def review_session_summary(
    session_id: int,
    review_data: ClinicalSummaryReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_doctor_session(session_id, current_user, db)
    clinical_summary = get_saved_summary(session_id, db)

    if clinical_summary.generation_status != "completed":
        raise HTTPException(
            status_code=409,
            detail=(
                "The summary cannot be reviewed until generation is completed. "
                "Current generation status: "
                f"{clinical_summary.generation_status}."
            ),
        )

    current_status = clinical_summary.review_status
    new_status = review_data.review_status

    if current_status != new_status and not can_change_status(
        current_status,
        new_status,
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot change review status from '{current_status}' "
                f"to '{new_status}'."
            ),
        )

    if new_status in {"reviewed", "approved"} and not (
        review_data.doctor_notes or ""
    ).strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "Doctor notes are required before marking a summary "
                "as reviewed or approved."
            ),
        )

    try:
        clinical_summary.review_status = new_status
        clinical_summary.doctor_notes = review_data.doctor_notes
        db.commit()
        db.refresh(clinical_summary)
    except Exception:
        db.rollback()
        logger.exception(
            "Unable to save review for session %s.",
            session_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to save the review.",
        )

    return summary_response(session_id, clinical_summary)
