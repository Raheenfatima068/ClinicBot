
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from dependencies import get_current_admin_user
from auth import hash_password


router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/dashboard")
def get_admin_dashboard(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()

    total_patients = (
        db.query(User)
        .filter(User.role == "patient")
        .count()
    )

    total_doctors = (
        db.query(User)
        .filter(User.role == "doctor")
        .count()
    )

    total_admins = (
        db.query(User)
        .filter(User.role == "admin")
        .count()
    )

    return {
        "message": "Admin dashboard data retrieved successfully",
        "admin": {
            "id": current_admin.id,
            "name": current_admin.full_name,
            "email": current_admin.email,
            "role": current_admin.role
        },
        "statistics": {
            "total_users": total_users,
            "total_patients": total_patients,
            "total_doctors": total_doctors,
            "total_admins": total_admins
        }
    }


@router.post("/doctors")
def create_doctor(
    full_name: str,
    email: str,
    password: str,
    specialty: str,
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    full_name = full_name.strip()
    email = email.strip().lower()
    specialty = specialty.strip()

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Doctor name is required"
        )

    if not email.endswith("@clinicbot.com"):
        raise HTTPException(
            status_code=400,
            detail="Doctor email must end with @clinicbot.com"
        )

    if len(password) < 12:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 12 characters"
        )

    if not specialty:
        raise HTTPException(
            status_code=400,
            detail="Doctor specialty is required"
        )

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered"
        )

    doctor = User(
        full_name=full_name,
        email=email,
        password_hash=hash_password(password),
        role="doctor",
        specialty=specialty
    )

    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    return {
        "message": "Doctor created successfully",
        "doctor": {
            "id": doctor.id,
            "full_name": doctor.full_name,
            "email": doctor.email,
            "specialty": doctor.specialty,
            "role": doctor.role
        }
    }


@router.get("/doctors")
def list_doctors(
    current_admin: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    doctors = (
        db.query(User)
        .filter(User.role == "doctor")
        .order_by(User.full_name)
        .all()
    )

    return {
        "doctors": [
            {
                "id": doctor.id,
                "full_name": doctor.full_name,
                "email": doctor.email,
                "specialty": doctor.specialty,
                "role": doctor.role
            }
            for doctor in doctors
        ]
    }