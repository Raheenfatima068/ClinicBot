
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from database import engine


def migrate():
    with engine.begin() as connection:
        # Add a separate status for AI summary generation.
        connection.execute(
            text(
                """
                ALTER TABLE clinical_summaries
                ADD COLUMN IF NOT EXISTS generation_status
                VARCHAR(20) NOT NULL DEFAULT 'completed'
                """
            )
        )

        # Preserve existing summaries and give them a known status.
        # Existing records already contain a saved summary.
        connection.execute(
            text(
                """
                UPDATE clinical_summaries
                SET generation_status = 'completed'
                WHERE generation_status IS NULL
                """
            )
        )

        # Ensure future rows default to pending generation.
        connection.execute(
            text(
                """
                ALTER TABLE clinical_summaries
                ALTER COLUMN generation_status
                SET DEFAULT 'pending'
                """
            )
        )

    print("Summary generation status migration completed.")


if __name__ == "__main__":
    migrate()
