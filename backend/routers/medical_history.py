
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, IntakeSession, MedicalHistory
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Medical History"]
)


@router.post("/sessions/{session_id}/medical-history")
def add_medical_history(
    session_id: int,
    condition_name: str,
    details: str | None = None,
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

    history = MedicalHistory(
        intake_session_id=session_id,
        condition_name=condition_name,
        details=details
    )

    db.add(history)
    db.commit()
    db.refresh(history)

    return history


@router.get("/sessions/{session_id}/medical-history")
def get_medical_history(
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

    history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .all()
    )

    return history

