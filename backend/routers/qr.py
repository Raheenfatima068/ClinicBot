
import os
import secrets
import hashlib
import base64
from io import BytesIO
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import qrcode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import User, PatientProfile, IntakeSession, IntakeQRToken


router = APIRouter(
    prefix="/intake",
    tags=["Intake QR"],
)


QR_EXPIRY_MINUTES = 30


class QRValidationRequest(BaseModel):
    token: str


def hash_qr_token(token: str) -> str:
    """Hash the original QR token before storing it."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_patient_session(
    session_id: int,
    current_user: User,
    db: Session,
):
    """Return a session only if it belongs to the logged-in patient."""

    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can access their intake QR codes.",
        )

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a clinic.",
        )

    session = (
        db.query(IntakeSession)
        .join(
            PatientProfile,
            IntakeSession.patient_id == PatientProfile.id,
        )
        .filter(
            IntakeSession.id == session_id,
            PatientProfile.user_id == current_user.id,
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    return session


@router.post("/sessions/{session_id}/qr")
def generate_intake_qr(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate or replace the QR token for an existing patient session.
    The original token is never stored in the database.
    """

    session = get_patient_session(
        session_id=session_id,
        current_user=current_user,
        db=db,
    )

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_qr_token(raw_token)

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=QR_EXPIRY_MINUTES)

    # Each session has one QR-token row because intake_session_id is unique.
    qr_record = (
        db.query(IntakeQRToken)
        .filter(
            IntakeQRToken.intake_session_id == session.id
        )
        .first()
    )

    if qr_record:
        qr_record.token_hash = token_hash
        qr_record.expires_at = expires_at
        qr_record.used_at = None
    else:
        qr_record = IntakeQRToken(
            intake_session_id=session.id,
            token_hash=token_hash,
            expires_at=expires_at,
            used_at=None,
        )
        db.add(qr_record)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to generate the intake QR code.",
        )

    frontend_url = os.getenv(
        "FRONTEND_BASE_URL",
        "http://localhost:3000",
    ).rstrip("/")

    query_string = urlencode({
        "session_id": session.id,
        "qr_token": raw_token,
    })

    intake_url = (
        f"{frontend_url}/patient/intake?{query_string}"
    )

    # Generate the QR image as a PNG.
    qr_image = qrcode.make(intake_url)

    image_buffer = BytesIO()
    qr_image.save(image_buffer, format="PNG")

    image_base64 = base64.b64encode(
        image_buffer.getvalue()
    ).decode("utf-8")

    return {
        "message": "QR code generated successfully.",
        "session_id": session.id,
        "qr_code": f"data:image/png;base64,{image_base64}",
        "qr_url": intake_url,
        "expires_at": expires_at.isoformat(),
        "expires_in_minutes": QR_EXPIRY_MINUTES,
    }


@router.post("/qr/validate")
def validate_intake_qr(
    payload: QRValidationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Validate a QR token for the logged-in patient.
    A valid token can only be used once.
    """

    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can validate intake QR codes.",
        )

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a clinic.",
        )

    raw_token = payload.token.strip()

    if not raw_token or len(raw_token) > 200:
        raise HTTPException(
            status_code=400,
            detail="Invalid QR token.",
        )

    token_hash = hash_qr_token(raw_token)

    qr_record = (
        db.query(IntakeQRToken)
        .filter(IntakeQRToken.token_hash == token_hash)
        .first()
    )

    if qr_record is None:
        raise HTTPException(
            status_code=404,
            detail="QR code is invalid or no longer available.",
        )

    # Confirm that this QR code belongs to the logged-in patient.
    session = get_patient_session(
        session_id=qr_record.intake_session_id,
        current_user=current_user,
        db=db,
    )

    now = datetime.now(timezone.utc)

    expires_at = qr_record.expires_at

    # Handle a naive datetime defensively if one is returned by the DB.
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        raise HTTPException(
            status_code=410,
            detail="This QR code has expired. Please generate a new one.",
        )

    if qr_record.used_at is not None:
        raise HTTPException(
            status_code=410,
            detail="This QR code has already been used.",
        )

    # Atomically mark the token as used to prevent simultaneous reuse.
    updated_rows = (
        db.query(IntakeQRToken)
        .filter(
            IntakeQRToken.id == qr_record.id,
            IntakeQRToken.used_at.is_(None),
            IntakeQRToken.expires_at > now,
        )
        .update(
            {IntakeQRToken.used_at: now},
            synchronize_session=False,
        )
    )

    if updated_rows != 1:
        db.rollback()
        raise HTTPException(
            status_code=410,
            detail="This QR code has expired or has already been used.",
        )

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to validate the QR code.",
        )

    return {
        "valid": True,
        "message": "QR code validated successfully.",
        "session_id": session.id,
        "status": session.status,
    }
