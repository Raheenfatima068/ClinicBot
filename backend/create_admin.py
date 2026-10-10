
from getpass import getpass

from database import SessionLocal
from models import User
from auth import hash_password


def main():
    email = "raheen@gmail.com"
    db = SessionLocal()

    try:
        existing = db.query(User).filter(User.email == email).first()

        if existing:
            if existing.role == "admin":
                print("This admin account already exists.")
            else:
                print(
                    "This email belongs to an existing non-admin account. "
                    "No changes were made."
                )
            return

        password = getpass("Set admin password (minimum 12 characters): ")
        confirm = getpass("Confirm admin password: ")

        if len(password) < 12:
            print("Password must contain at least 12 characters.")
            return

        if password != confirm:
            print("Passwords do not match. No account created.")
            return

        admin = User(
            full_name="Raheen Fatima",
            email=email,
            password_hash=hash_password(password),
            role="admin",
            specialty=None,
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully!")
        print("Email: raheen@gmail.com")
        print("Role: admin")

    except Exception:
        db.rollback()
        print("Account creation failed. No changes were saved.")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()