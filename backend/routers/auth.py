
import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

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


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


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

    # Public patient registration joins the configured main clinic.
    # Do not accept tenant_id or role from the public request.
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

        # Email delivery is not configured yet.
        # Generate development reset links only.
        environment = os.getenv(
            "ENVIRONMENT", "development"
        ).strip().lower()

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

        # Generate a secure random token.
        raw_token = secrets.token_urlsafe(32)

        # Store only its SHA-256 hash in the database.
        token_hash = hashlib.sha256(
            raw_token.encode("utf-8")
        ).hexdigest()

        reset_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(minutes=30),
        )

        db.add(reset_record)
        db.commit()

        frontend_base_url = os.getenv(
            "FRONTEND_BASE_URL",
            "http://localhost:3000",
        ).rstrip("/")

        reset_url = (
            f"{frontend_base_url}/patient/reset-password"
            f"?token={quote(raw_token, safe='')}"
        )

        # Local development only.
        # Do not print reset tokens in production logs.
        print(
            f"[PASSWORD RESET - DEVELOPMENT] "
            f"User ID {user.id}: {reset_url}"
        )

        return {"message": generic_message}

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to process the password-reset request.",
        )

    except Exception:
        db.rollback()
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
    now = datetime.now(timezone.utc)

    token_hash = hashlib.sha256(
        payload.token.encode("utf-8")
    ).hexdigest()

    try:
        reset_record = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token_hash == token_hash
            )
            .first()
        )

        if (
            reset_record is None
            or reset_record.used_at is not None
            or reset_record.expires_at <= now
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "The reset link is invalid or expired. "
                    "Please request a new link."
                ),
            )

        user = (
            db.query(User)
            .filter(User.id == reset_record.user_id)
            .first()
        )

        if user is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The reset link is invalid or expired. "
                    "Please request a new link."
                ),
            )

        # Update the user's password.
        user.password_hash = hash_password(
            payload.new_password
        )

        # Mark this token as used.
        reset_record.used_at = now

        # Invalidate all other unused reset tokens for this user.
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

        db.commit()

        return {
            "message": "Your password has been reset successfully."
        }

    except HTTPException:
        db.rollback()
        raise

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to reset the password. Please try again.",
        )

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to reset the password. Please try again.",
        )
