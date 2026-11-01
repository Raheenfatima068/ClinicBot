
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, IntakeSession, MedicalHistory, PatientConsent
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Medical History"],
)

CURRENT_CONSENT_VERSION = "1.0"

ALLOWED_HISTORY_TYPES = {
    "condition",
    "surgery",
    "hospitalization",
}


# --------------------------------------------------
# CONSENT AUTHORIZATION
# --------------------------------------------------

def require_current_consent(
    current_user: User,
    db: Session,
) -> None:
    """Require acceptance of the current consent version."""

    consent = (
        db.query(PatientConsent)
        .filter(
            PatientConsent.user_id == current_user.id,
            PatientConsent.consent_version == CURRENT_CONSENT_VERSION,
        )
        .first()
    )

    if consent is None:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "CONSENT_REQUIRED",
                "message": (
                    "You must accept the current Consent and Privacy "
                    "Notice before continuing your intake."
                ),
                "consent_version": CURRENT_CONSENT_VERSION,
            },
        )


# --------------------------------------------------
# PATIENT SESSION AUTHORIZATION
# --------------------------------------------------

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


# --------------------------------------------------
# ADD MEDICAL HISTORY
# Supports conditions, surgeries, and hospitalizations
# --------------------------------------------------

@router.post("/sessions/{session_id}/medical-history")
def add_medical_history(
    session_id: int,
    condition_name: str,
    details: str | None = None,
    history_type: str = "condition",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify patient and session ownership.
    get_patient_session(session_id, current_user, db)

    # Require current consent.
    require_current_consent(current_user, db)

    condition_name = condition_name.strip()
    history_type = history_type.strip().lower()

    if not condition_name:
        raise HTTPException(
            status_code=400,
            detail="Condition name or history description is required.",
        )

    if history_type not in ALLOWED_HISTORY_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid history_type. Choose condition, surgery, "
                "or hospitalization."
            ),
        )

    if details is not None:
        details = details.strip() or None

    history = MedicalHistory(
        intake_session_id=session_id,
        condition_name=condition_name,
        details=details,
        history_type=history_type,
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


# --------------------------------------------------
# GET MEDICAL HISTORY
# Returns all history types for the session
# --------------------------------------------------

@router.get("/sessions/{session_id}/medical-history")
def get_medical_history(
    session_id: int,
    history_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify patient and session ownership.
    get_patient_session(session_id, current_user, db)

    # Require current consent.
    require_current_consent(current_user, db)

    query = db.query(MedicalHistory).filter(
        MedicalHistory.intake_session_id == session_id
    )

    if history_type is not None:
        history_type = history_type.strip().lower()

        if history_type not in ALLOWED_HISTORY_TYPES:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Invalid history_type. Choose condition, surgery, "
                    "or hospitalization."
                ),
            )

        query = query.filter(
            MedicalHistory.history_type == history_type
        )

    return query.order_by(MedicalHistory.id).all()
