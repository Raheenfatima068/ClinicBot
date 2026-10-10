
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
)
from dependencies import get_current_user
from schemas import ClinicalSummaryReview
from services.gemini_service import generate_soap_summary


router = APIRouter(
    prefix="/ai",
    tags=["AI Summary"],
)


def clean_soap_summary(summary: str) -> str:
    """
    Clean common escaped Markdown formatting returned by Gemini.
    Preserve the SOAP content rather than changing its meaning.
    """
    if not summary:
        return ""

    summary = summary.strip()

    # Convert escaped Markdown bold markers to normal Markdown.
    summary = summary.replace(r"\*\*", "**")
    summary = summary.replace(r"\*", "*")
    summary = summary.replace(r"\_", "_")

    # Remove unnecessary whitespace.
    summary = re.sub(r"[ \t]+\n", "\n", summary)
    summary = re.sub(r"\n{3,}", "\n\n", summary)

    return summary.strip()


def get_patient_session(
    session_id: int,
    current_user: User,
    db: Session,
):
    """Find a session belonging to the logged-in patient."""
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

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found",
        )

    return session


def get_saved_summary(
    session_id: int,
    db: Session,
):
    """Find the saved summary for a session."""
    summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if not summary:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found",
        )

    return summary


def summary_response(session_id: int, summary: ClinicalSummary):
    return {
        "session_id": session_id,
        "summary_id": summary.id,
        "review_status": summary.review_status,
        "summary": summary.summary,
        "doctor_notes": summary.doctor_notes,
        "created_at": summary.created_at,
        "updated_at": summary.updated_at,
    }


# ============================================================
# POST: Generate and Save SOAP Summary
# ============================================================

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
                item.symptom_name for item in symptoms
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
                item.allergen for item in allergies
            ],
        )

        summary = clean_soap_summary(raw_summary)

        if not summary:
            raise HTTPException(
                status_code=502,
                detail="The AI service returned an empty summary.",
            )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to generate the clinical summary. Please try again.",
        ) from exc

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if clinical_summary:
        # Update the text without silently resetting an existing
        # doctor's review status or doctor's notes.
        clinical_summary.summary = summary
    else:
        clinical_summary = ClinicalSummary(
            intake_session_id=session_id,
            summary=summary,
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

    return summary_response(session_id, clinical_summary)


# ============================================================
# GET: Retrieve Saved SOAP Summary
# ============================================================

@router.get("/sessions/{session_id}/soap-summary")
def get_saved_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(
        session_id,
        current_user,
        db,
    )

    clinical_summary = get_saved_summary(
        session_id,
        db,
    )

    # Clean legacy formatting when returning previously saved data.
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
                detail="Unable to update clinical summary formatting.",
            ) from exc

    return summary_response(session_id, clinical_summary)


# ============================================================
# PUT: Update Clinical Summary Review
# ============================================================

@router.put("/sessions/{session_id}/soap-summary/review")
def review_session_summary(
    session_id: int,
    review_data: ClinicalSummaryReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # This endpoint retains the patient-ownership check from your
    # original code. Use the existing doctor-specific review
    # endpoint for doctor accounts.
    get_patient_session(
        session_id,
        current_user,
        db,
    )

    clinical_summary = get_saved_summary(
        session_id,
        db,
    )

    allowed_statuses = {
        "pending",
        "reviewed",
        "approved",
    }

    if review_data.review_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid review status. Allowed values: "
                "pending, reviewed, approved"
            ),
        )

    clinical_summary.review_status = review_data.review_status
    clinical_summary.doctor_notes = review_data.doctor_notes

    try:
        db.commit()
        db.refresh(clinical_summary)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the review.",
        ) from exc

    return summary_response(session_id, clinical_summary)