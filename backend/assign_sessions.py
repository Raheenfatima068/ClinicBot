
from database import SessionLocal
from models import User, ClinicalSummary, IntakeSession

db = SessionLocal()

try:
    doctor = db.query(User).filter(
        User.email == "doctor@clinicbot.com",
        User.role == "doctor"
    ).first()

    if doctor is None:
        print("ERROR: Doctor account not found.")
    else:
        summaries = db.query(ClinicalSummary).all()

        session_ids = {
            summary.intake_session_id
            for summary in summaries
        }

        sessions = db.query(IntakeSession).filter(
            IntakeSession.id.in_(session_ids)
        ).all()

        for session in sessions:
            session.assigned_doctor_id = doctor.id

        db.commit()

        print("Doctor:", doctor.full_name)
        print("Doctor ID:", doctor.id)
        print("Sessions assigned:", len(sessions))
        print("Assignment completed successfully.")

except Exception as error:
    db.rollback()
    print("ERROR:", error)

finally:
    db.close()
