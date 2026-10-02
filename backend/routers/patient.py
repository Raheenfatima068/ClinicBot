from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, PatientProfile
from dependencies import get_current_user


router = APIRouter(
    prefix="/patients",
    tags=["Patient Profile"]
)


@router.post("/profile")
def create_patient_profile(
    age: int | None = None,
    gender: str | None = None,
    phone: str | None = None,
    preferred_language: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_profile = (
        db.query(PatientProfile)
        .filter(PatientProfile.user_id == current_user.id)
        .first()
    )

    if existing_profile:
        raise HTTPException(
            status_code=400,
            detail="Patient profile already exists"
        )

    profile = PatientProfile(
        user_id=current_user.id,
        age=age,
        gender=gender,
        phone=phone,
        preferred_language=preferred_language
    )

    db.add(profile)
    db.commit()
    db.refresh(profile)

    return profile


@router.get("/profile")
def get_patient_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = (
        db.query(PatientProfile)
        .filter(PatientProfile.user_id == current_user.id)
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    return profile