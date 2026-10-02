
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, IntakeSession, Medication
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Medications"]
)


@router.post("/sessions/{session_id}/medications")
def add_medication(
    session_id: int,
    medication_name: str,
    dosage: str | None = None,
    frequency: str | None = None,
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

    medication = Medication(
        intake_session_id=session_id,
        medication_name=medication_name,
        dosage=dosage,
        frequency=frequency
    )

    db.add(medication)
    db.commit()
    db.refresh(medication)

    return medication


@router.get("/sessions/{session_id}/medications")
def get_medications(
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

    medications = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .all()
    )

    return medications

