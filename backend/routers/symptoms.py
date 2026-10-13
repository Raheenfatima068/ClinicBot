
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, IntakeSession, Symptom
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Symptoms"],
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


@router.post("/sessions/{session_id}/symptoms")
def add_symptom(
    session_id: int,
    symptom_name: str,
    severity: str | None = None,
    duration: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    symptom_name = symptom_name.strip()

    if not symptom_name:
        raise HTTPException(
            status_code=400,
            detail="Symptom name is required.",
        )

    symptom = Symptom(
        intake_session_id=session_id,
        symptom_name=symptom_name,
        severity=severity,
        duration=duration,
    )

    try:
        db.add(symptom)
        db.commit()
        db.refresh(symptom)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the symptom.",
        ) from exc

    return symptom


@router.get("/sessions/{session_id}/symptoms")
def get_symptoms(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    symptoms = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session_id
        )
        .all()
    )

    return symptoms
