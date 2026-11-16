
import hashlib
import hmac
import logging
import os
import secrets

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, PatientProfile, Clinic, PasswordResetToken
from schemas import (
    UserRegister,
    UserResponse,
    UserLogin,
    TokenResponse,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
)
from dependencies import get_current_user


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


# =========================================================
# PASSWORD RESET CONFIGURATION
# =========================================================

RESET_TOKEN_EXPIRY_MINUTES = 30

RESET_LINK_ERROR = (
    "The reset link is invalid or expired. "
    "Please request a new link."
)


# =========================================================
# DATETIME HELPER
# =========================================================

def normalize_utc(value: datetime) -> datetime:
    """
    Ensure datetime values are timezone-aware UTC.

    PostgreSQL normally returns timezone-aware values for
    DateTime(timezone=True). This also handles a naive value
    defensively if one is encountered.
    """

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


# =========================================================
# PASSWORD RESET SCHEMAS
# =========================================================

class PasswordResetRequest(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=12, max_length=72)

    @field_validator("token")
    @classmethod
    def normalize_token(cls, value: str) -> str:
        return value.strip()

    @field_validator("new_password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError(
                "Password must not exceed 72 UTF-8 bytes."
            )

        return value


# =========================================================
# REGISTER
# =========================================================

@router.post("/register", response_model=UserResponse)
def register_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).strip().lower()

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email already registered",
        )

    clinic = (
        db.query(Clinic)
        .filter(Clinic.slug == "clinicbot-main")
        .first()
    )

    if clinic is None:
        raise HTTPException(
            status_code=500,
            detail="Clinic registration is not configured.",
        )

    try:
        new_user = User(
            full_name=user_data.full_name,
            email=email,
            password_hash=hash_password(user_data.password),
            role="patient",
            tenant_id=clinic.id,
        )

        db.add(new_user)
        db.flush()

        patient_profile = PatientProfile(
            user_id=new_user.id,
            age=None,
            gender=None,
            phone=None,
            preferred_language="English",
        )

        db.add(patient_profile)
        db.commit()
        db.refresh(new_user)

        return new_user

    except SQLAlchemyError:
        db.rollback()

        logger.exception("Patient registration failed.")

        raise HTTPException(
            status_code=500,
            detail="Registration could not be completed.",
        )


# =========================================================
# LOGIN
# =========================================================

@router.post("/login", response_model=TokenResponse)
def login_user(
    user_data: UserLogin,
    db: Session = Depends(get_db),
):
    email = str(user_data.email).strip().lower()

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None or not verify_password(
        user_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your account is not assigned to a clinic. "
                "Contact an administrator."
            ),
        )

    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "tenant_id": user.tenant_id,
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


# =========================================================
# GET CURRENT USER
# =========================================================

@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user


# =========================================================
# REQUEST PASSWORD RESET
# =========================================================

@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
):
    generic_message = (
        "If this email is registered, password-reset instructions "
        "will be available."
    )

    try:
        email = str(payload.email).strip().lower()

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        # Do not reveal whether an email exists.
        if user is None:
            return {"message": generic_message}

        environment = os.getenv(
            "ENVIRONMENT",
            "development",
        ).strip().lower()

        # Development links are not generated in production.
        if environment != "development":
            return {"message": generic_message}

        now = datetime.now(timezone.utc)

        # Invalidate previous unused reset tokens.
        previous_tokens = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
            )
            .all()
        )

        for previous_token in previous_tokens:
            previous_token.used_at = now

        # Generate a new secure random token.
        raw_token = secrets.token_urlsafe(32)

        # Store only the SHA-256 hash.
        token_hash = hashlib.sha256(
            raw_token.encode("utf-8")
        ).hexdigest()

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=(
                now + timedelta(
                    minutes=RESET_TOKEN_EXPIRY_MINUTES
                )
            ),
        )

        db.add(reset_record)

        # Save token before displaying its reset URL.
        db.commit()

        frontend_base_url = os.getenv(
            "FRONTEND_BASE_URL",
            "http://localhost:3000",
        ).rstrip("/")

        query_string = urlencode({
            "token": raw_token
        })

        reset_url = (
            f"{frontend_base_url}/patient/reset-password"
            f"?{query_string}"
        )

        # Development only. Never print reset links in production.
        logger.info(
            "[PASSWORD RESET - DEVELOPMENT] "
            "Reset link generated for user ID %s: %s",
            user.id,
            reset_url,
        )

        return {"message": generic_message}

    except SQLAlchemyError:
        db.rollback()

        logger.exception(
            "Database error while requesting password reset."
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to process the password-reset request.",
        )

    except Exception:
        db.rollback()

        logger.exception(
            "Unexpected error while requesting password reset."
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to process the password-reset request.",
        )


# =========================================================
# CONFIRM PASSWORD RESET
# =========================================================

@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
):
    try:
        now = datetime.now(timezone.utc)

        # Normalize the incoming token.
        raw_token = payload.token.strip()

        if not raw_token:
            raise HTTPException(
                status_code=400,
                detail=RESET_LINK_ERROR,
            )

        # Calculate the same SHA-256 hash used during creation.
        token_hash = hashlib.sha256(
            raw_token.encode("utf-8")
        ).hexdigest()

        logger.info(
            "[PASSWORD RESET] Confirmation request received. "
            "Token length: %s",
            len(raw_token),
        )

        # Find the matching token record.
        reset_record = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash
            )
            .with_for_update()
            .first()
        )

        if reset_record is None:
            logger.warning(
                "[PASSWORD RESET] No matching token record found."
            )

            raise HTTPException(
                status_code=400,
                detail=RESET_LINK_ERROR,
            )

        logger.info(
            "[PASSWORD RESET] Matching record found. "
            "Record ID: %s, User ID: %s",
            reset_record.id,
            reset_record.user_id,
        )

        # Check whether the token has already been used.
        if reset_record.used_at is not None:
            logger.warning(
                "[PASSWORD RESET] Token has already been used. "
                "Record ID: %s",
                reset_record.id,
            )

            raise HTTPException(
                status_code=400,
                detail=RESET_LINK_ERROR,
            )

        # Normalize stored expiration datetime.
        expires_at = normalize_utc(
            reset_record.expires_at
        )

        # Check expiration.
        if expires_at <= now:
            logger.warning(
                "[PASSWORD RESET] Token has expired. "
                "Record ID: %s",
                reset_record.id,
            )

            raise HTTPException(
                status_code=400,
                detail=RESET_LINK_ERROR,
            )

        logger.info(
            "[PASSWORD RESET] Token validation successful. "
            "Record ID: %s",
            reset_record.id,
        )

        # Find the associated user.
        user = (
            db.query(User)
            .filter(User.id == reset_record.user_id)
            .first()
        )

        if user is None:
            logger.warning(
                "[PASSWORD RESET] Associated user not found."
            )

            raise HTTPException(
                status_code=400,
                detail=RESET_LINK_ERROR,
            )

        # Update password.
        user.password_hash = hash_password(
            payload.new_password
        )

        # Mark current token as used.
        reset_record.used_at = now

        # Invalidate all other unused tokens belonging to this user.
        other_tokens = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.id != reset_record.id,
            )
            .all()
        )

        for other_token in other_tokens:
            other_token.used_at = now

        # Save password and token status together.
        db.commit()

        logger.info(
            "[PASSWORD RESET] Password successfully updated "
            "for user ID %s.",
            user.id,
        )

        return {
            "message": (
                "Your password has been reset successfully."
            )
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError as exc:
        db.rollback()

        logger.exception(
            "Password reset validation error."
        )

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except SQLAlchemyError:
        db.rollback()

        logger.exception(
            "Database error while confirming password reset."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to reset the password. Please try again."
            ),
        )

    except Exception:
        db.rollback()

        logger.exception(
            "Unexpected error while confirming password reset."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to reset the password. Please try again."
            ),
        )
