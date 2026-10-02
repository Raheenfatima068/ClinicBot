from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, IntakeSession, Allergy
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Allergies"]
)


@router.post("/sessions/{session_id}/allergies")
def add_allergy(
    session_id: int,
    allergen: str,
    reaction: str | None = None,
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

    allergy = Allergy(
        intake_session_id=session_id,
        allergen=allergen,
        reaction=reaction
    )

    db.add(allergy)
    db.commit()
    db.refresh(allergy)

    return allergy


@router.get("/sessions/{session_id}/allergies")
def get_allergies(
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

    allergies = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .all()
    )

    return allergies