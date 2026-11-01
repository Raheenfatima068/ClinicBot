
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import PatientConsent, User


router = APIRouter(
    prefix="/consent",
    tags=["Patient Consent"],
)

# Increase this version whenever the consent notice is materially updated.
CURRENT_CONSENT_VERSION = "1.0"


class ConsentAcceptRequest(BaseModel):
    accepted: bool


@router.get("/status")
def get_consent_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Patient access required.",
        )

    consent = (
        db.query(PatientConsent)
        .filter(
            PatientConsent.user_id == current_user.id,
            PatientConsent.consent_version == CURRENT_CONSENT_VERSION,
        )
        .first()
    )

    return {
        "accepted": consent is not None,
        "consent_version": CURRENT_CONSENT_VERSION,
        "accepted_at": consent.accepted_at if consent else None,
    }


@router.post("/accept")
def accept_consent(
    request: ConsentAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Patient access required.",
        )

    if request.accepted is not True:
        raise HTTPException(
            status_code=400,
            detail="You must accept the consent notice to continue.",
        )

    existing_consent = (
        db.query(PatientConsent)
        .filter(
            PatientConsent.user_id == current_user.id,
            PatientConsent.consent_version == CURRENT_CONSENT_VERSION,
        )
        .first()
    )

    if existing_consent:
        return {
            "message": "Consent has already been recorded.",
            "accepted": True,
            "consent_version": CURRENT_CONSENT_VERSION,
            "accepted_at": existing_consent.accepted_at,
        }

    consent = PatientConsent(
        user_id=current_user.id,
        consent_version=CURRENT_CONSENT_VERSION,
    )

    try:
        db.add(consent)
        db.commit()
        db.refresh(consent)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not save consent. Please try again.",
        )

    return {
        "message": "Consent recorded successfully.",
        "accepted": True,
        "consent_version": CURRENT_CONSENT_VERSION,
        "accepted_at": consent.accepted_at,
    }
