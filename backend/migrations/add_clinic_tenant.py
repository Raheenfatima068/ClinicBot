
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from database import engine
def migrate():
    with engine.begin() as connection:
        # Create the clinics table if it does not already exist.
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS clinics (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL,
                    slug VARCHAR(100) NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
                """
            )
        )

        # Add the tenant reference without deleting or recreating users.
        connection.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS tenant_id INTEGER
                """
            )
        )

        # Add the foreign key only if it does not already exist.
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_users_tenant_id_clinics'
                    ) THEN
                        ALTER TABLE users
                        ADD CONSTRAINT fk_users_tenant_id_clinics
                        FOREIGN KEY (tenant_id)
                        REFERENCES clinics(id);
                    END IF;
                END
                $$;
                """
            )
        )

        connection.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS ix_users_tenant_id
                ON users (tenant_id)
                """
            )
        )

        # Create the initial clinic for existing users.
        connection.execute(
            text(
                """
                INSERT INTO clinics (name, slug)
                VALUES ('ClinicBot Main Clinic', 'clinicbot-main')
                ON CONFLICT (slug) DO NOTHING
                """
            )
        )

        # Assign existing users to the initial clinic.
        connection.execute(
            text(
                """
                UPDATE users
                SET tenant_id = (
                    SELECT id
                    FROM clinics
                    WHERE slug = 'clinicbot-main'
                )
                WHERE tenant_id IS NULL
                """
            )
        )

        # Confirm no existing user was left without clinic membership.
        unassigned = connection.execute(
            text(
                """
                SELECT COUNT(*)
                FROM users
                WHERE tenant_id IS NULL
                """
            )
        ).scalar_one()

        if unassigned:
            raise RuntimeError(
                f"Migration stopped: {unassigned} users lack a clinic."
            )

    print("Clinic tenant migration completed successfully.")


if __name__ == "__main__":
    migrate()
