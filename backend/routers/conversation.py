
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import (
    User,
    IntakeSession,
    Symptom,
    MedicalHistory,
    Medication,
    Allergy,
)
from dependencies import get_current_user


router = APIRouter(
    prefix="/conversation",
    tags=["Conversational Intake"],
)


# --------------------------------------------------
# SESSION AUTHORIZATION
# --------------------------------------------------

def get_session(
    session_id: int,
    current_user: User,
    db: Session,
) -> IntakeSession:
    """
    Return an intake session only when:
    1. The authenticated user is a patient.
    2. The patient belongs to a clinic.
    3. The session belongs to that patient.
    4. The patient's clinic matches the authenticated user's clinic.
    5. The assigned doctor belongs to the same clinic.
    """

    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can access conversational intake.",
        )

    if current_user.tenant_id is None:
        raise HTTPException(
            status_code=403,
            detail="Your account is not assigned to a clinic.",
        )

    # Find a session owned by the authenticated patient.
    session = (
        db.query(IntakeSession)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            ),
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    # Explicitly verify the patient's clinic assignment.
    patient = session.patient

    if (
        patient is None
        or patient.user is None
        or patient.user.tenant_id != current_user.tenant_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Intake session not found.",
        )

    # Verify that the assigned doctor belongs to the same clinic.
    doctor = (
        db.query(User)
        .filter(
            User.id == session.assigned_doctor_id,
            User.role == "doctor",
            User.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    if doctor is None:
        raise HTTPException(
            status_code=403,
            detail=(
                "The session is not assigned to a doctor "
                "in your clinic."
            ),
        )

    return session


# --------------------------------------------------
# GET NEXT INTAKE QUESTION
# GET /conversation/sessions/{session_id}/next-question
# --------------------------------------------------

@router.get("/sessions/{session_id}/next-question")
def get_next_question(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = get_session(
        session_id=session_id,
        current_user=current_user,
        db=db,
    )

    if not session.chief_complaint:
        return {
            "question": "What is your main health concern today?",
            "field": "chief_complaint",
        }

    if not session.symptom_duration:
        return {
            "question": (
                "How long have you been experiencing this problem?"
            ),
            "field": "symptom_duration",
        }

    symptom = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session.id
        )
        .first()
    )

    if not symptom:
        return {
            "question": "What symptoms are you experiencing?",
            "field": "symptoms",
        }

    history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session.id
        )
        .first()
    )

    if not history:
        return {
            "question": (
                "Do you have any previous medical conditions "
                "or health history?"
            ),
            "field": "medical_history",
        }

    medication = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session.id
        )
        .first()
    )

    if not medication:
        return {
            "question": "Are you currently taking any medications?",
            "field": "medications",
        }

    allergy = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session.id
        )
        .first()
    )

    if not allergy:
        return {
            "question": (
                "Do you have any known allergies to medicines, "
                "foods, or other substances?"
            ),
            "field": "allergies",
        }

    return {
        "question": (
            "Thank you. We have collected the basic information."
        ),
        "field": "complete",
    }


# --------------------------------------------------
# SUBMIT INTAKE ANSWER
# POST /conversation/sessions/{session_id}/answer
# --------------------------------------------------

@router.post("/sessions/{session_id}/answer")
def submit_answer(
    session_id: int,
    answer: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = get_session(
        session_id=session_id,
        current_user=current_user,
        db=db,
    )


    answer = answer.strip()

    if not answer:
        raise HTTPException(
            status_code=422,
            detail="Answer cannot be empty.",
        )

    if len(answer) > 2000:
        raise HTTPException(
            status_code=422,
            detail="Answer must not exceed 2000 characters.",
        )


    try:
        # Step 1: Save the chief complaint.
        if not session.chief_complaint:
            session.chief_complaint = answer
            saved_field = "chief_complaint"

        # Step 2: Save symptom duration.
        elif not session.symptom_duration:
            session.symptom_duration = answer
            saved_field = "symptom_duration"

        else:
            # Step 3: Save symptoms.
            symptom = (
                db.query(Symptom)
                .filter(
                    Symptom.intake_session_id == session.id
                )
                .first()
            )

            if not symptom:
                db.add(
                    Symptom(
                        intake_session_id=session.id,
                        symptom_name=answer,
                    )
                )
                saved_field = "symptoms"

            else:
                # Step 4: Save medical history.
                history = (
                    db.query(MedicalHistory)
                    .filter(
                        MedicalHistory.intake_session_id
                        == session.id
                    )
                    .first()
                )

                if not history:
                    db.add(
                        MedicalHistory(
                            intake_session_id=session.id,
                            condition_name=answer,
                        )
                    )
                    saved_field = "medical_history"

                else:
                    # Step 5: Save medications.
                    medication = (
                        db.query(Medication)
                        .filter(
                            Medication.intake_session_id
                            == session.id
                        )
                        .first()
                    )

                    if not medication:
                        db.add(
                            Medication(
                                intake_session_id=session.id,
                                medication_name=answer,
                            )
                        )
                        saved_field = "medications"

                    else:
                        # Step 6: Save allergies.
                        allergy = (
                            db.query(Allergy)
                            .filter(
                                Allergy.intake_session_id
                                == session.id
                            )
                            .first()
                        )

                        if not allergy:
                            db.add(
                                Allergy(
                                    intake_session_id=session.id,
                                    allergen=answer,
                                )
                            )
                            saved_field = "allergies"

                        else:
                            return {
                                "message": (
                                    "Basic intake information "
                                    "is already complete."
                                ),
                                "field": "complete",
                            }

        db.commit()

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to save the answer.",
        )

    return {
        "message": "Answer saved successfully.",
        "field": saved_field,
        "answer": answer,
    }
