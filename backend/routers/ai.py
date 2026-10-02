from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    IntakeSession,
    Symptom,
    MedicalHistory,
    Medication,
    Allergy
)
from dependencies import get_current_user
from services.gemini_service import generate_soap_summary


router = APIRouter(
    prefix="/ai",
    tags=["AI Summary"]
)


@router.post("/sessions/{session_id}/soap-summary")
def generate_session_summary(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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

    return {
        "session_id": session_id,
        "summary": summary
    }