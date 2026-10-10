
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, PatientProfile, IntakeSession
from dependencies import get_current_user


router = APIRouter(
    prefix="/intake",
    tags=["Intake Sessions"]
)


def find_suitable_doctor(
    chief_complaint: str | None,
    db: Session
) -> User | None:
    """
    Select a doctor based on the reported complaint.
    This is routing only, not medical diagnosis.
    """

    complaint = (chief_complaint or "").strip().lower()

    specialty_keywords = {
        "Cardiology": [
            "chest pain", "palpitations", "heart pain",
            "heart racing", "heartbeat"
        ],
        "Neurology": [
            "headache", "migraine", "dizziness", "seizure",
            "numbness", "tingling"
        ],
        "Dermatology": [
            "rash", "itching", "skin", "acne", "eczema"
        ],
        "Respiratory Medicine": [
            "cough", "breathing", "shortness of breath",
            "wheezing", "asthma"
        ],
        "Gastroenterology": [
            "stomach pain", "abdominal pain", "nausea",
            "vomiting", "diarrhea", "constipation"
        ],
        "Orthopedics": [
            "joint pain", "back pain", "bone pain",
            "knee pain", "fracture"
        ],
    }

    doctors = (
        db.query(User)
        .filter(User.role == "doctor")
        .order_by(User.id)
        .all()
    )

    if not doctors:
        return None

    for specialty, keywords in specialty_keywords.items():
        if any(keyword in complaint for keyword in keywords):
            matching_doctor = next(
                (
                    doctor for doctor in doctors
                    if (doctor.specialty or "").strip().lower()
                    == specialty.lower()
                ),
                None
            )

            if matching_doctor:
                return matching_doctor

    general_specialties = {
        "general medicine",
        "family medicine",
        "internal medicine",
    }

    general_doctor = next(
        (
            doctor for doctor in doctors
            if (doctor.specialty or "").strip().lower()
            in general_specialties
        ),
        None
    )

    if general_doctor:
        return general_doctor

    # Fallback if no specialty matches.
    return doctors[0]


@router.post("/sessions")
def create_intake_session(
    chief_complaint: str | None = None,
    symptom_duration: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only patients may create intake sessions.
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can create intake sessions"
        )

    profile = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    assigned_doctor = find_suitable_doctor(
        chief_complaint,
        db
    )

    if assigned_doctor is None:
        raise HTTPException(
            status_code=503,
            detail="No doctor is available. Please try again later."
        )

    session = IntakeSession(
        patient_id=profile.id,
        assigned_doctor_id=assigned_doctor.id,
        status="active",
        chief_complaint=chief_complaint,
        symptom_duration=symptom_duration
    )

    try:
        db.add(session)
        db.commit()
        db.refresh(session)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Unable to create intake session"
        )

    return {
        "id": session.id,
        "patient_id": session.patient_id,
        "assigned_doctor_id": session.assigned_doctor_id,
        "assigned_doctor": {
            "id": assigned_doctor.id,
            "name": assigned_doctor.full_name,
            "specialty": assigned_doctor.specialty
        },
        "status": session.status,
        "chief_complaint": session.chief_complaint,
        "symptom_duration": session.symptom_duration,
        "created_at": session.created_at
    }


@router.get("/sessions")
def get_intake_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only patients may access their patient intake history.
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can access their intake history"
        )

    profile = (
        db.query(PatientProfile)
        .filter(
            PatientProfile.user_id == current_user.id
        )
        .first()
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    sessions = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.patient_id == profile.id
        )
        .order_by(IntakeSession.id.desc())
        .all()
    )

    return sessions

