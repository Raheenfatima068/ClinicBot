
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, IntakeSession, Medication
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Medications"],
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


@router.post("/sessions/{session_id}/medications")
def add_medication(
    session_id: int,
    medication_name: str,
    dosage: str | None = None,
    frequency: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    medication_name = medication_name.strip()

    if not medication_name:
        raise HTTPException(
            status_code=400,
            detail="Medication name is required.",
        )

    medication = Medication(
        intake_session_id=session_id,
        medication_name=medication_name,
        dosage=dosage,
        frequency=frequency,
    )

    try:
        db.add(medication)
        db.commit()
        db.refresh(medication)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the medication.",
        ) from exc

    return medication


@router.get("/sessions/{session_id}/medications")
def get_medications(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    medications = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .all()
    )

    return medications
