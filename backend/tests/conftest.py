
import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy.engine import make_url
from sqlalchemy import text
from fastapi.testclient import TestClient


# ---------------------------------------------------------
# Configure the isolated test database BEFORE importing app
# ---------------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BACKEND_DIR / ".env"

configured_url = (
    os.environ.get("DATABASE_URL")
    or dotenv_values(ENV_FILE).get("DATABASE_URL")
)

if not configured_url:
    raise RuntimeError("DATABASE_URL was not found.")

test_url = make_url(configured_url).set(
    database="clinicbot_test_db"
)

os.environ["DATABASE_URL"] = test_url.render_as_string(
    hide_password=False
)


# Import application modules only after setting test URL.
from database import Base, engine, SessionLocal, get_db
from models import Clinic, User
from auth import hash_password
from main import app


# ---------------------------------------------------------
# Create test database tables
# ---------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    Base.metadata.create_all(bind=engine)

    yield

    # Keep tables for reuse; do not drop the test schema.


# ---------------------------------------------------------
# API client and database reset
# ---------------------------------------------------------

@pytest.fixture
def api_client(create_test_tables):

    # Clear only the isolated test database.
    table_names = [
        table.name
        for table in reversed(Base.metadata.sorted_tables)
    ]

    if table_names:
        quoted_names = ", ".join(
            f'"{name}"' for name in table_names
        )

        with engine.begin() as connection:
            connection.execute(
                text(
                    f"TRUNCATE TABLE {quoted_names} "
                    "RESTART IDENTITY CASCADE"
                )
            )

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()


# ---------------------------------------------------------
# Test clinic
# ---------------------------------------------------------

@pytest.fixture
def test_clinic(api_client):

    db = SessionLocal()

    try:
        clinic = Clinic(
            name="ClinicBot Test Clinic",
            slug="clinicbot-main",
        )

        db.add(clinic)
        db.commit()
        db.refresh(clinic)

        return clinic.id

    finally:
        db.close()


# ---------------------------------------------------------
# Test doctor
# ---------------------------------------------------------

@pytest.fixture
def test_doctor(api_client, test_clinic):

    db = SessionLocal()

    try:
        doctor = User(
            full_name="Test Doctor",
            email="doctor.test@clinicbot.com",
            password_hash=hash_password(
                "DoctorTest@123"
            ),
            role="doctor",
            specialty="Neurology",
            tenant_id=test_clinic,
        )

        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        return doctor.id

    finally:
        db.close()
