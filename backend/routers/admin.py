from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from dependencies import get_current_admin_user


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