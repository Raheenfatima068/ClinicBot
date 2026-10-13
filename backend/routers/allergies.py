
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, IntakeSession, Allergy
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Allergies"],
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


@router.post("/sessions/{session_id}/allergies")
def add_allergy(
    session_id: int,
    allergen: str,
    reaction: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    allergen = allergen.strip()

    if not allergen:
        raise HTTPException(
            status_code=400,
            detail="Allergen is required.",
        )

    allergy = Allergy(
        intake_session_id=session_id,
        allergen=allergen,
        reaction=reaction,
    )

    try:
        db.add(allergy)
        db.commit()
        db.refresh(allergy)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save the allergy.",
        ) from exc

    return allergy


@router.get("/sessions/{session_id}/allergies")
def get_allergies(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)

    allergies = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .all()
    )

    return allergies
