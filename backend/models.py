from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(150),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        nullable=False,
        default="patient"
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    profile = relationship(
        "PatientProfile",
        back_populates="user",
        uselist=False
    )


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    age = Column(
        Integer,
        nullable=True
    )

    gender = Column(
        String(20),
        nullable=True
    )

    phone = Column(
        String(30),
        nullable=True
    )

    preferred_language = Column(
        String(50),
        nullable=True
    )

    user = relationship(
        "User",
        back_populates="profile"
    )

    intake_sessions = relationship(
        "IntakeSession",
        back_populates="patient"
    )


class IntakeSession(Base):
    __tablename__ = "intake_sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    patient_id = Column(
        Integer,
        ForeignKey("patient_profiles.id"),
        nullable=False
    )

    status = Column(
        String(20),
        nullable=False,
        default="active"
    )

    chief_complaint = Column(
        String(500),
        nullable=True
    )

    symptom_duration = Column(
        String(100),
        nullable=True
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    patient = relationship(
        "PatientProfile",
        back_populates="intake_sessions"
    )

    symptoms = relationship(
        "Symptom",
        back_populates="intake_session",
        cascade="all, delete-orphan"
    )

    medical_history = relationship(
        "MedicalHistory",
        back_populates="intake_session",
        cascade="all, delete-orphan"
    )

    medications = relationship(
        "Medication",
        back_populates="intake_session",
        cascade="all, delete-orphan"
    )

    allergies = relationship(
        "Allergy",
        back_populates="intake_session",
        cascade="all, delete-orphan"
    )


class Symptom(Base):
    __tablename__ = "symptoms"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False
    )

    symptom_name = Column(
        String(200),
        nullable=False
    )

    severity = Column(
        String(20),
        nullable=True
    )

    duration = Column(
        String(100),
        nullable=True
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="symptoms"
    )


class MedicalHistory(Base):
    __tablename__ = "medical_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False
    )

    condition_name = Column(
        String(200),
        nullable=False
    )

    details = Column(
        String(500),
        nullable=True
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="medical_history"
    )


class Medication(Base):
    __tablename__ = "medications"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False
    )

    medication_name = Column(
        String(200),
        nullable=False
    )

    dosage = Column(
        String(100),
        nullable=True
    )

    frequency = Column(
        String(100),
        nullable=True
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="medications"
    )


class Allergy(Base):
    __tablename__ = "allergies"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    intake_session_id = Column(
        Integer,
        ForeignKey("intake_sessions.id"),
        nullable=False
    )

    allergen = Column(
        String(200),
        nullable=False
    )

    reaction = Column(
        String(500),
        nullable=True
    )

    intake_session = relationship(
        "IntakeSession",
        back_populates="allergies"
    )