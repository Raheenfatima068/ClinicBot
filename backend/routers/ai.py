
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
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


# --------------------------------------------------
# SOAP SUMMARY FORMATTING
# --------------------------------------------------

def clean_soap_summary(summary: str) -> str:
    """Clean escaped Markdown and excessive whitespace."""
    if not summary:
        return ""

    summary = summary.strip()

    # Convert escaped Markdown markers to normal Markdown.
    summary = summary.replace(r"\*\*", "**")
    summary = summary.replace(r"\*", "*")
    summary = summary.replace(r"\_", "_")

    # Remove trailing spaces before newlines.
    summary = re.sub(r"[ \t]+\n", "\n", summary)

    # Replace three or more consecutive newlines with two.
    summary = re.sub(r"\n{3,}", "\n\n", summary)

    return summary.strip()


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
        .join(IntakeSession.patient)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            ),
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    # Verify that the patient and session belong to the
    # authenticated patient's clinic.
    if (
        session.patient is None
        or session.patient.user is None
        or session.patient.user.tenant_id
        != current_user.tenant_id
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

            # Only the assigned doctor may access this session.
            IntakeSession.assigned_doctor_id
            == current_user.id,

            # The patient must belong to the same clinic
            # as the authenticated doctor.
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

    # Additional tenant validation.
    patient = session.patient

    if (
        patient is None
        or patient.user is None
        or patient.user.tenant_id
        != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    return session


# --------------------------------------------------
# GET SAVED SOAP SUMMARY
# --------------------------------------------------

def get_saved_summary(
    session_id: int,
    db: Session,
):
    """Find the saved clinical summary for an intake session."""

    summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if summary is None:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found.",
        )

    return summary


# --------------------------------------------------
# STANDARD SUMMARY RESPONSE
# --------------------------------------------------

def summary_response(
    session_id: int,
    summary: ClinicalSummary,
):
    """Return a consistent response for SOAP summary endpoints."""

    return {
        "session_id": session_id,
        "summary_id": summary.id,
        "review_status": summary.review_status,
        "summary": summary.summary,
        "doctor_notes": summary.doctor_notes,
        "created_at": summary.created_at,
        "updated_at": summary.updated_at,
    }


# --------------------------------------------------
# GENERATE SOAP SUMMARY
# POST /ai/sessions/{session_id}/soap-summary
# PATIENT ONLY
# --------------------------------------------------

@router.post("/sessions/{session_id}/soap-summary")
def generate_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = get_patient_session(
        session_id,
        current_user,
        db,
    )

    symptoms = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session_id
        )
        .all()
    )

    medical_history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .all()
    )

    medications = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .all()
    )

    allergies = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .all()
    )

    try:
        raw_summary = generate_soap_summary(
            chief_complaint=(
                session.chief_complaint or "Not provided"
            ),
            symptom_duration=(
                session.symptom_duration or "Not provided"
            ),
            symptoms=[
                item.symptom_name
                for item in symptoms
            ],
            medical_history=[
                item.condition_name
                for item in medical_history
            ],
            medications=[
                item.medication_name
                for item in medications
            ],
            allergies=[
                item.allergen
                for item in allergies
            ],
        )

        summary_text = clean_soap_summary(raw_summary)

        if not summary_text:
            raise HTTPException(
                status_code=502,
                detail="The AI service returned an empty summary.",
            )

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to generate the clinical summary. "
                "Please try again."
            ),
        ) from exc

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if clinical_summary:
        # Update the summary text while preserving the
        # existing doctor review status and notes.
        clinical_summary.summary = summary_text

    else:
        clinical_summary = ClinicalSummary(
            intake_session_id=session_id,
            summary=summary_text,
            review_status="pending",
        )
        db.add(clinical_summary)

    try:
        db.commit()
        db.refresh(clinical_summary)

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the clinical summary.",
        ) from exc

    return summary_response(
        session_id,
        clinical_summary,
    )


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
    # Patients can only access their own sessions.
    get_patient_session(
        session_id,
        current_user,
        db,
    )

    clinical_summary = get_saved_summary(
        session_id,
        db,
    )

    # Clean legacy formatting if necessary.
    cleaned_summary = clean_soap_summary(
        clinical_summary.summary or ""
    )

    if cleaned_summary != clinical_summary.summary:
        clinical_summary.summary = cleaned_summary

        try:
            db.commit()
            db.refresh(clinical_summary)

        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=(
                    "Unable to update clinical summary formatting."
                ),
            ) from exc

    return summary_response(
        session_id,
        clinical_summary,
    )


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
    # Verify doctor role, session assignment, and tenant.
    get_doctor_session(
        session_id,
        current_user,
        db,
    )

    clinical_summary = get_saved_summary(
        session_id,
        db,
    )

    return summary_response(
        session_id,
        clinical_summary,
    )


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
    # Verify doctor role, assignment, and clinic access.
    get_doctor_session(
        session_id,
        current_user,
        db,
    )

    clinical_summary = get_saved_summary(
        session_id,
        db,
    )

    current_status = clinical_summary.review_status
    new_status = review_data.review_status

    # Prevent invalid status transitions.
    if current_status != new_status and not can_change_status(
        current_status,
        new_status,
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                f"Cannot change review status from "
                f"'{current_status}' to '{new_status}'."
            ),
        )

    # Require meaningful notes for completed reviews.
    if new_status in {"reviewed", "approved"} and not (
        review_data.doctor_notes or ""
    ).strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "Doctor notes are required before marking "
                "a summary as reviewed or approved."
            ),
        )

    clinical_summary.review_status = new_status
    clinical_summary.doctor_notes = review_data.doctor_notes

    try:
        db.commit()
        db.refresh(clinical_summary)
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Unable to save clinical summary review for session %s.",
            session_id,
        )
        raise HTTPException(
            status_code=500,
            detail="Unable to save the review.",
        ) from exc

    return summary_response(
        session_id,
        clinical_summary,
    )
