
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


# ==================================================
# CLINIC
# ==================================================

class Clinic(Base):
    __tablename__ = "clinics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="clinic")


# ==================================================
# USER
# ==================================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Clinic membership for multi-tenant isolation.
    tenant_id = Column(
        Integer,
        ForeignKey("clinics.id"),
        nullable=True,
        index=True,
    )

    full_name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="patient")
    specialty = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clinic = relationship("Clinic", back_populates="users")

    profile = relationship(
        "PatientProfile",
        back_populates="user",
        uselist=False,
    )


# ==================================================
# PATIENT PROFILE
# ==================================================

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    phone = Column(String(30), nullable=True)
    preferred_language = Column(String(50), nullable=True)

    user = relationship("User", back_populates="profile")

    intake_sessions = relationship(
        "IntakeSession",
        back_populates="patient",
    )


# ==================================================
# INTAKE SESSION
# ==================================================

class IntakeSession(Base):
    __tablename__ = "intake_sessions"

    id = Column(Integer, primary_key=True, index=True)

    patient_id = Column(
        Integer,
        ForeignKey("patient_profiles.id"),
        nullable=False,
    )

    assigned_doctor_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    status = Column(String(20), nullable=False, default="active")
    chief_complaint = Column(String(500), nullable=True)
    symptom_duration = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("PatientProfile", back_populates="intake_sessions")

    symptoms = relationship(
        "Symptom",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )

    medical_history = relationship(
        "MedicalHistory",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )

    medications = relationship(
        "Medication",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )

    allergies = relationship(
        "Allergy",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )

    clinical_summary = relationship(
        "ClinicalSummary",
        back_populates="intake_session",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # Family medical history.
    family_histories = relationship(
        "FamilyHistory",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )

    # Uploaded medical document metadata.
    medical_documents = relationship(
        "MedicalDocument",
        back_populates="intake_session",
        cascade="all, delete-orphan",
    )


# ==================================================
# SYMPTOM
# ==================================================

class Symptom(Base):
    __tablename__ = "symptoms"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
    )

    symptom_name = Column(String(200), nullable=False)
    severity = Column(String(20), nullable=True)
    duration = Column(String(100), nullable=True)

    intake_session = relationship(
        "IntakeSession",
        back_populates="symptoms",
    )


# ==================================================
# MEDICAL HISTORY
# ==================================================

class MedicalHistory(Base):
    __tablename__ = "medical_history"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
    )

    condition_name = Column(String(200), nullable=False)
    details = Column(String(500), nullable=True)

    # Condition, surgery, or hospitalization.
    history_type = Column(
        String(50),
        nullable=False,
        default="condition",
        server_default="condition",
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="medical_history",
    )


# ==================================================
# FAMILY MEDICAL HISTORY
# ==================================================

class FamilyHistory(Base):
    __tablename__ = "family_histories"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    condition_name = Column(String(200), nullable=False)
    relationship_to_patient = Column(String(100), nullable=True)
    details = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="family_histories",
    )


# ==================================================
# MEDICATION
# ==================================================

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
    )

    medication_name = Column(String(200), nullable=False)
    dosage = Column(String(100), nullable=True)
    frequency = Column(String(100), nullable=True)

    intake_session = relationship(
        "IntakeSession",
        back_populates="medications",
    )


# ==================================================
# ALLERGY
# ==================================================

class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
    )

    allergen = Column(String(200), nullable=False)
    reaction = Column(String(500), nullable=True)

    intake_session = relationship(
        "IntakeSession",
        back_populates="allergies",
    )


# ==================================================
# CLINICAL SUMMARY
# ==================================================

class ClinicalSummary(Base):
    __tablename__ = "clinical_summaries"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
        unique=True,
    )

    summary = Column(String(5000), nullable=False)

    # Doctor review workflow.
    review_status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    # AI/background generation workflow.
    generation_status = Column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    doctor_notes = Column(String(5000), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="clinical_summary",
    )


# ==================================================
# MEDICAL DOCUMENT METADATA
# ==================================================

class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    uploaded_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )

    # File contents are stored separately in private storage.
    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), unique=True, nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)

    uploaded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="medical_documents",
    )


# ==================================================
# INTAKE QR TOKEN
# ==================================================

class IntakeQRToken(Base):
    __tablename__ = "intake_qr_tokens"

    id = Column(Integer, primary_key=True, index=True)

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    token_hash = Column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
    )

    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


# ==================================================
# PASSWORD RESET TOKEN
# ==================================================

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


# ==================================================
# PATIENT CONSENT
# ==================================================

class PatientConsent(Base):
    __tablename__ = "patient_consents"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    consent_version = Column(String(50), nullable=False)

    accepted_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
