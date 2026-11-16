
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, FamilyHistory
from dependencies import get_current_user

from routers.medical_history import (
    get_patient_session,
    require_current_consent,
)


router = APIRouter(
    prefix="/intake",
    tags=["Family Medical History"],
)


ALLOWED_FAMILY_CONDITIONS = {
    "diabetes",
    "hypertension",
    "heart disease",
}


@router.post("/sessions/{session_id}/family-history")
def add_family_history(
    session_id: int,
    condition_name: str,
    relationship_to_patient: str | None = None,
    details: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Save a family medical history record for a patient's intake."""

    # Preserve the existing patient, tenant, and session checks.
    get_patient_session(session_id, current_user, db)
    require_current_consent(current_user, db)

    condition_name = condition_name.strip().lower()

    if condition_name not in ALLOWED_FAMILY_CONDITIONS:
        raise HTTPException(
            status_code=422,
            detail=(
                "Condition must be diabetes, hypertension, "
                "or heart disease."
            ),
        )

    if relationship_to_patient is not None:
        relationship_to_patient = relationship_to_patient.strip() or None

    if details is not None:
        details = details.strip() or None

    record = FamilyHistory(
        intake_session_id=session_id,
        condition_name=condition_name,
        relationship_to_patient=relationship_to_patient,
        details=details,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to save family medical history.",
        ) from exc

    return record


@router.get("/sessions/{session_id}/family-history")
def get_family_history(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve family history for the patient's own intake session."""

    get_patient_session(session_id, current_user, db)
    require_current_consent(current_user, db)

    records = (
        db.query(FamilyHistory)
        .filter(
            FamilyHistory.intake_session_id == session_id
        )
        .order_by(FamilyHistory.id)
        .all()
    )

    return records
