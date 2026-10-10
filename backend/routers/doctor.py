
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    PatientProfile,
    IntakeSession,
    Symptom,
    MedicalHistory,
    Medication,
    Allergy,
    ClinicalSummary,
)
from dependencies import get_current_user
from schemas import ClinicalSummaryReview


router = APIRouter(
    prefix="/doctor",
    tags=["Doctor Dashboard"],
)


def require_doctor(current_user: User):
    if current_user.role != "doctor":
        raise HTTPException(
            status_code=403,
            detail="Doctor access required",
        )

    return current_user


@router.get("/dashboard")
def doctor_dashboard(
    review_status: str | None = None,
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_doctor(current_user)

    allowed_statuses = ["pending", "reviewed", "approved"]

    if (
        review_status is not None
        and review_status not in allowed_statuses
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid review status. "
                "Allowed values: pending, reviewed, approved"
            ),
        )

    # Normalize the search text. Empty or whitespace-only
    # searches should display all sessions.
    search_text = (search or "").strip().lower()

    # Retrieve only sessions assigned to the logged-in doctor.
    sessions = (
        db.query(IntakeSession)
        .join(IntakeSession.patient)
        .join(PatientProfile.user)
        .filter(
            IntakeSession.assigned_doctor_id == current_user.id
        )
        .all()
    )

    dashboard_data = []

    pending_reviews = 0
    reviewed_summaries = 0
    approved_summaries = 0

    for session in sessions:
        patient = session.patient

        if patient is None or patient.user is None:
            continue

        user = patient.user

        # Search by patient name, email, or chief complaint.
        patient_name = (
            (user.full_name or "").strip().lower()
        )
        patient_email = (
            (user.email or "").strip().lower()
        )
        complaint = (
            (session.chief_complaint or "").strip().lower()
        )

        if search_text and not any(
            search_text in field
            for field in (
                patient_name,
                patient_email,
                complaint,
            )
        ):
            continue

        # Get the clinical summary for this intake session.
        clinical_summary = (
            db.query(ClinicalSummary)
            .filter(
                ClinicalSummary.intake_session_id == session.id
            )
            .first()
        )

        # Calculate review statistics for sessions matching
        # the search, regardless of the selected status filter.
        if clinical_summary:
            if clinical_summary.review_status == "pending":
                pending_reviews += 1
            elif clinical_summary.review_status == "reviewed":
                reviewed_summaries += 1
            elif clinical_summary.review_status == "approved":
                approved_summaries += 1

        # Apply the selected review-status filter to the list.
        if review_status is not None:
            if clinical_summary is None:
                continue

            if clinical_summary.review_status != review_status:
                continue

        # Retrieve related intake information.
        symptoms = (
            db.query(Symptom)
            .filter(
                Symptom.intake_session_id == session.id
            )
            .all()
        )

        medical_history = (
            db.query(MedicalHistory)
            .filter(
                MedicalHistory.intake_session_id == session.id
            )
            .all()
        )

        medications = (
            db.query(Medication)
            .filter(
                Medication.intake_session_id == session.id
            )
            .all()
        )

        allergies = (
            db.query(Allergy)
            .filter(
                Allergy.intake_session_id == session.id
            )
            .all()
        )

        summary_data = None

        if clinical_summary:
            summary_data = {
                "summary_id": clinical_summary.id,
                "summary": clinical_summary.summary,
                "review_status": clinical_summary.review_status,
                "doctor_notes": clinical_summary.doctor_notes,
                "created_at": clinical_summary.created_at,
                "updated_at": clinical_summary.updated_at,
            }

        # Add the session to the dashboard response.
        dashboard_data.append(
            {
                "patient": {
                    "patient_id": patient.id,
                    "user_id": user.id,
                    "full_name": user.full_name,
                    "email": user.email,
                    "age": patient.age,
                    "gender": patient.gender,
                    "phone": patient.phone,
                    "preferred_language": patient.preferred_language,
                },
                "intake_session": {
                    "session_id": session.id,
                    "status": session.status,
                    "chief_complaint": session.chief_complaint,
                    "symptom_duration": session.symptom_duration,
                    "created_at": session.created_at,
                },
                "symptoms": [
                    {
                        "id": item.id,
                        "name": item.symptom_name,
                        "severity": item.severity,
                        "duration": item.duration,
                    }
                    for item in symptoms
                ],
                "medical_history": [
                    {
                        "id": item.id,
                        "condition": item.condition_name,
                        "details": item.details,
                    }
                    for item in medical_history
                ],
                "medications": [
                    {
                        "id": item.id,
                        "name": item.medication_name,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                    }
                    for item in medications
                ],
                "allergies": [
                    {
                        "id": item.id,
                        "allergen": item.allergen,
                        "reaction": item.reaction,
                    }
                    for item in allergies
                ],
                "clinical_summary": summary_data,
            }
        )

    return {
        "message": "Doctor dashboard data retrieved successfully",
        "doctor": {
            "id": current_user.id,
            "name": current_user.full_name,
            "role": current_user.role,
        },
        "statistics": {
            "total_sessions": len(dashboard_data),
            "pending_reviews": pending_reviews,
            "reviewed_summaries": reviewed_summaries,
            "approved_summaries": approved_summaries,
        },
        "total_sessions": len(dashboard_data),
        "filter": {
            "review_status": review_status,
            "search": search,
        },
        "sessions": dashboard_data,
    }


@router.get("/sessions/{session_id}")
def get_doctor_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_doctor(current_user)

    # A doctor can access only their own assigned sessions.
    session = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.assigned_doctor_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found",
        )

    patient = session.patient

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found",
        )

    user = patient.user

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Patient user not found",
        )

    symptoms = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session_id
        )
        .all()
    )

    medical_history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .all()
    )

    medications = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .all()
    )

    allergies = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .all()
    )

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    summary_data = None

    if clinical_summary:
        summary_data = {
            "summary_id": clinical_summary.id,
            "summary": clinical_summary.summary,
            "review_status": clinical_summary.review_status,
            "doctor_notes": clinical_summary.doctor_notes,
            "created_at": clinical_summary.created_at,
            "updated_at": clinical_summary.updated_at,
        }

    return {
        "message": "Doctor session details retrieved successfully",
        "patient": {
            "patient_id": patient.id,
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "age": patient.age,
            "gender": patient.gender,
            "phone": patient.phone,
            "preferred_language": patient.preferred_language,
        },
        "intake_session": {
            "session_id": session.id,
            "status": session.status,
            "chief_complaint": session.chief_complaint,
            "symptom_duration": session.symptom_duration,
            "created_at": session.created_at,
        },
        "symptoms": [
            {
                "id": item.id,
                "name": item.symptom_name,
                "severity": item.severity,
                "duration": item.duration,
            }
            for item in symptoms
        ],
        "medical_history": [
            {
                "id": item.id,
                "condition": item.condition_name,
                "details": item.details,
            }
            for item in medical_history
        ],
        "medications": [
            {
                "id": item.id,
                "name": item.medication_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
            }
            for item in medications
        ],
        "allergies": [
            {
                "id": item.id,
                "allergen": item.allergen,
                "reaction": item.reaction,
            }
            for item in allergies
        ],
        "clinical_summary": summary_data,
    }


@router.put("/sessions/{session_id}/review")
def review_doctor_session(
    session_id: int,
    review_data: ClinicalSummaryReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_doctor(current_user)

    # Verify the doctor owns the assigned session.
    session = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.assigned_doctor_id == current_user.id,
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found",
        )

    clinical_summary = (
        db.query(ClinicalSummary)
        .filter(
            ClinicalSummary.intake_session_id == session_id
        )
        .first()
    )

    if not clinical_summary:
        raise HTTPException(
            status_code=404,
            detail="Clinical summary not found",
        )

    allowed_statuses = ["pending", "reviewed", "approved"]

    if review_data.review_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid review status. "
                "Allowed values: pending, reviewed, approved"
            ),
        )

    clinical_summary.review_status = review_data.review_status
    clinical_summary.doctor_notes = review_data.doctor_notes

    db.commit()
    db.refresh(clinical_summary)

    return {
        "message": "Clinical summary reviewed successfully",
        "session_id": session_id,
        "summary_id": clinical_summary.id,
        "review_status": clinical_summary.review_status,
        "doctor_notes": clinical_summary.doctor_notes,
        "summary": clinical_summary.summary,
        "created_at": clinical_summary.created_at,
        "updated_at": clinical_summary.updated_at,
    }
