
import sys
from pathlib import Path

# Make the backend directory importable when this script is run directly.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import inspect, text

from database import Base, engine
import models  # noqa: F401 - registers model classes with Base.metadata


NEW_TABLES = [
    "family_histories",
    "medical_documents",
    "intake_qr_tokens",
    "password_reset_tokens",
    "patient_consents",
]


def migrate():
    # Create only the missing tables required by the recovered features.
    # Existing tables and records are not dropped or replaced.
    tables_to_create = [
        Base.metadata.tables[name]
        for name in NEW_TABLES
    ]

    Base.metadata.create_all(
        bind=engine,
        tables=tables_to_create,
        checkfirst=True,
    )

    # Add the new column to the existing medical_history table.
    # Existing rows receive "condition" as their initial value.
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE medical_history
                ADD COLUMN IF NOT EXISTS history_type
                VARCHAR(50) NOT NULL DEFAULT 'condition'
                """
            )
        )

    # Verify that the database contains the expected schema.
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    missing_tables = [
        name for name in NEW_TABLES
        if name not in existing_tables
    ]

    if missing_tables:
        raise RuntimeError(
            f"Migration incomplete; missing tables: {missing_tables}"
        )

    history_columns = {
        column["name"]
        for column in inspector.get_columns("medical_history")
    }

    if "history_type" not in history_columns:
        raise RuntimeError(
            "Migration incomplete; medical_history.history_type is missing."
        )

    print("Patient feature migration completed successfully.")
    print("Verified tables:", ", ".join(NEW_TABLES))
    print("Verified column: medical_history.history_type")


if __name__ == "__main__":
    migrate()
