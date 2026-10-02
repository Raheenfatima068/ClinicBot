from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    User,
    IntakeSession,
    Symptom,
    MedicalHistory,
    Medication,
    Allergy
)
from dependencies import get_current_user


router = APIRouter(
    prefix="/conversation",
    tags=["Conversational Intake"]
)


def get_session(
    session_id: int,
    current_user: User,
    db: Session
):
    session = (
        db.query(IntakeSession)
        .join(IntakeSession.patient)
        .filter(
            IntakeSession.id == session_id,
            IntakeSession.patient.has(
                user_id=current_user.id
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Intake session not found"
        )

    return session


@router.get("/sessions/{session_id}/next-question")
def get_next_question(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = get_session(
        session_id,
        current_user,
        db
    )

    # Step 1: Chief Complaint
    if not session.chief_complaint:
        return {
            "question": "What is your main health concern today?",
            "field": "chief_complaint"
        }

    # Step 2: Symptom Duration
    if not session.symptom_duration:
        return {
            "question": "How long have you been experiencing this problem?",
            "field": "symptom_duration"
        }

    # Step 3: Symptoms
    symptom = (
        db.query(Symptom)
        .filter(
            Symptom.intake_session_id == session_id
        )
        .first()
    )

    if not symptom:
        return {
            "question": "What symptoms are you experiencing?",
            "field": "symptoms"
        }

    # Step 4: Medical History
    history = (
        db.query(MedicalHistory)
        .filter(
            MedicalHistory.intake_session_id == session_id
        )
        .first()
    )

    if not history:
        return {
            "question": "Do you have any previous medical conditions or health history?",
            "field": "medical_history"
        }

    # Step 5: Medications
    medication = (
        db.query(Medication)
        .filter(
            Medication.intake_session_id == session_id
        )
        .first()
    )

    if not medication:
        return {
            "question": "Are you currently taking any medications?",
            "field": "medications"
        }

    # Step 6: Allergies
    allergy = (
        db.query(Allergy)
        .filter(
            Allergy.intake_session_id == session_id
        )
        .first()
    )

    if not allergy:
        return {
            "question": "Do you have any known allergies to medicines, foods, or other substances?",
            "field": "allergies"
        }

    # Intake Complete
    return {
        "question": "Thank you. We have collected the basic information.",
        "field": "complete"
    }


@router.post("/sessions/{session_id}/answer")
def submit_answer(
    session_id: int,
    answer: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = get_session(
        session_id,
        current_user,
        db
    )

    # Step 1: Save Chief Complaint
    if not session.chief_complaint:
        session.chief_complaint = answer
        saved_field = "chief_complaint"

    # Step 2: Save Symptom Duration
    elif not session.symptom_duration:
        session.symptom_duration = answer
        saved_field = "symptom_duration"

    else:
        # Step 3: Save Symptoms
        symptom = (
            db.query(Symptom)
            .filter(
                Symptom.intake_session_id == session_id
            )
            .first()
        )

        if not symptom:
            symptom = Symptom(
                intake_session_id=session_id,
                symptom_name=answer
            )

            db.add(symptom)
            saved_field = "symptoms"

        else:
            # Step 4: Save Medical History
            history = (
                db.query(MedicalHistory)
                .filter(
                    MedicalHistory.intake_session_id == session_id
                )
                .first()
            )

            if not history:
                history = MedicalHistory(
                    intake_session_id=session_id,
                    condition_name=answer
                )

                db.add(history)
                saved_field = "medical_history"

            else:
                # Step 5: Save Medication
                medication = (
                    db.query(Medication)
                    .filter(
                        Medication.intake_session_id == session_id
                    )
                    .first()
                )

                if not medication:
                    medication = Medication(
                        intake_session_id=session_id,
                        medication_name=answer
                    )

                    db.add(medication)
                    saved_field = "medications"

                else:
                    # Step 6: Save Allergy
                    allergy = (
                        db.query(Allergy)
                        .filter(
                            Allergy.intake_session_id == session_id
                        )
                        .first()
                    )

                    if not allergy:
                        allergy = Allergy(
                            intake_session_id=session_id,
                            allergen=answer
                        )

                        db.add(allergy)
                        saved_field = "allergies"

                    else:
                        return {
                            "message": "Basic intake information is already complete.",
                            "field": "complete"
                        }

    db.commit()

    return {
        "message": "Answer saved successfully.",
        "field": saved_field,
        "answer": answer
    }