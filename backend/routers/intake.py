
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, PatientProfile, IntakeSession
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Intake Sessions"]
)


@router.post("/sessions")
def create_intake_session(
    chief_complaint: str | None = None,
    symptom_duration: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    session = IntakeSession(
        patient_id=profile.id,
        status="active",
        chief_complaint=chief_complaint,
        symptom_duration=symptom_duration
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


@router.get("/sessions")
def get_intake_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    sessions = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.patient_id == profile.id
        )
        .all()
    )

    return sessions

