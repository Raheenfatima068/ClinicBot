
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
    ClinicalSummary
)
from dependencies import get_current_user
from schemas import ClinicalSummaryReview
from services.gemini_service import generate_soap_summary


router = APIRouter(
    prefix="/ai",
    tags=["AI Summary"]
)


# ============================================================
# POST: Generate and Save SOAP Summary
# ============================================================

@router.post("/sessions/{session_id}/soap-summary")
def generate_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find the intake session and make sure it belongs
    # to the currently logged-in user
    session = (
        db.query(IntakeSession)
        .join(IntakeSession.patient)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found"
        )

    # --------------------------------------------------------
    # Get symptoms
    # --------------------------------------------------------

    symptoms = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Get medical history
    # --------------------------------------------------------

    medical_history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Get medications
    # --------------------------------------------------------

    medications = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Get allergies
    # --------------------------------------------------------

    allergies = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .all()
    )

    # --------------------------------------------------------
    # Generate SOAP summary using Gemini
    # --------------------------------------------------------

    summary = generate_soap_summary(
        chief_complaint=session.chief_complaint or "Not provided",
        symptom_duration=session.symptom_duration or "Not provided",
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
        ]
    )

    # --------------------------------------------------------
    # Check if summary already exists
    # --------------------------------------------------------

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    # --------------------------------------------------------
    # Update existing summary
    # --------------------------------------------------------

    if clinical_summary:
        clinical_summary.summary = summary
        clinical_summary.review_status = "pending"

    # --------------------------------------------------------
    # Create new summary
    # --------------------------------------------------------

    else:
        clinical_summary = ClinicalSummary(
            intake_session_id=session_id,
            summary=summary,
            review_status="pending"
        )

        db.add(clinical_summary)

    # --------------------------------------------------------
    # Save to database
    # --------------------------------------------------------

    db.commit()
    db.refresh(clinical_summary)

    return {
        "session_id": session_id,
        "summary_id": clinical_summary.id,
        "review_status": clinical_summary.review_status,
        "summary": clinical_summary.summary
    }


# ============================================================
# GET: Retrieve Saved SOAP Summary
# ============================================================

@router.get("/sessions/{session_id}/soap-summary")
def get_saved_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find the intake session and verify ownership
    session = (
        db.query(IntakeSession)
        .join(IntakeSession.patient)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found"
        )

    # Find saved clinical summary
    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if not clinical_summary:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found"
        )

    return {
        "session_id": session_id,
        "summary_id": clinical_summary.id,
        "review_status": clinical_summary.review_status,
        "summary": clinical_summary.summary,
        "doctor_notes": clinical_summary.doctor_notes,
        "created_at": clinical_summary.created_at,
        "updated_at": clinical_summary.updated_at
    }


# ============================================================
# PUT: Doctor Review / Update Summary
# ============================================================

@router.put("/sessions/{session_id}/soap-summary/review")
def review_session_summary(
    session_id: int,
    review_data: ClinicalSummaryReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # --------------------------------------------------------
    # Verify that the intake session exists
    # and belongs to the logged-in user
    # --------------------------------------------------------

    session = (
        db.query(IntakeSession)
        .join(IntakeSession.patient)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found"
        )

    # --------------------------------------------------------
    # Find the saved clinical summary
    # --------------------------------------------------------

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if not clinical_summary:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found"
        )

    # --------------------------------------------------------
    # Validate review status
    # --------------------------------------------------------

    allowed_statuses = [
        "pending",
        "reviewed",
        "approved"
    ]

    if review_data.review_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid review status. "
                "Allowed values: pending, reviewed, approved"
            )
        )

    # --------------------------------------------------------
    # Update review information
    # --------------------------------------------------------

    clinical_summary.review_status = review_data.review_status
    clinical_summary.doctor_notes = review_data.doctor_notes

    # --------------------------------------------------------
    # Save changes
    # --------------------------------------------------------

    db.commit()
    db.refresh(clinical_summary)

    return {
        "session_id": session_id,
        "summary_id": clinical_summary.id,
        "review_status": clinical_summary.review_status,
        "summary": clinical_summary.summary,
        "doctor_notes": clinical_summary.doctor_notes,
        "created_at": clinical_summary.created_at,
        "updated_at": clinical_summary.updated_at
    }

