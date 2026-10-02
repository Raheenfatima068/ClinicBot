from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, IntakeSession, Symptom
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Symptoms"]
)


@router.post("/sessions/{session_id}/symptoms")
def add_symptom(
    session_id: int,
    symptom_name: str,
    severity: str | None = None,
    duration: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = (
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

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found"
        )

    symptom = Symptom(
        intake_session_id=session_id,
        symptom_name=symptom_name,
        severity=severity,
        duration=duration
    )

    db.add(symptom)
    db.commit()
    db.refresh(symptom)

    return symptom


@router.get("/sessions/{session_id}/symptoms")
def get_symptoms(
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

    return symptoms