
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, IntakeSession, MedicalHistory
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Medical History"],
)


def get_patient_session(
    session_id: int,
    current_user: User,
    db: Session,
):
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Patient access required.",
        )

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a clinic.",
        )

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

    if (
        session is None
        or session.patient is None
        or session.patient.user is None
        or session.patient.user.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    return session


@router.post("/sessions/{session_id}/medical-history")
def add_medical_history(
    session_id: int,
    condition_name: str,
    details: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    condition_name = condition_name.strip()

    if not condition_name:
        raise HTTPException(
            status_code=400,
            detail="Condition name is required.",
        )

    history = MedicalHistory(
        intake_session_id=session_id,
        condition_name=condition_name,
        details=details,
    )

    try:
        db.add(history)
        db.commit()
        db.refresh(history)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save medical history.",
        ) from exc

    return history


@router.get("/sessions/{session_id}/medical-history")
def get_medical_history(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .all()
    )

    return history
