
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, PatientProfile, Clinic
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

    # Return 409 if the email is already registered.
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

    # Issue a token containing the user's current clinic membership.
    access_token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "tenant_id": user.tenant_id,
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return current_user
