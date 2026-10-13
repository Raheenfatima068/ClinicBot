# ClinicBot – Clinical Intake Agent

## Project Overview
ClinicBot is a pre-consultation patient intake and symptom summary portal. It helps collect patient information before a consultation and supports doctors in reviewing clinical summaries.

ClinicBot does not autonomously diagnose patients or prescribe medication. Doctors remain responsible for reviewing patient information.

## Technology Stack
- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Python, FastAPI
- Database: PostgreSQL
- Authentication: JWT bearer tokens
- Password security: Argon2 password hashing
- AI summaries: Google Gemini API

## Main Features
- Patient registration and login
- Secure password hashing and JWT authentication
- Clinic-based tenant isolation
- Patient symptom and medical-history intake
- Doctor dashboard and session review
- Clinical summary review and approval

## Project Structure
- `backend/` – FastAPI application, database models, routes, and migrations
- `frontend/` – Next.js patient and doctor interfaces
- `.env.example` – Example environment configuration
- `.gitignore` – Excludes local secrets and generated files

## Prerequisites
- Python 3
- Node.js and npm
- PostgreSQL
- Required API credentials for enabled AI features

## Backend Setup
1. Open a terminal in the project root.
2. Activate your Python virtual environment.
3. Install the backend dependencies listed in `backend/requirements.txt`.
4. Configure environment variables using `backend/.env`.
5. Start the backend from the project root:

   `python -m uvicorn main:app --app-dir backend --port 8001 --reload`

6. Open the API documentation at `http://127.0.0.1:8001/docs`.

## Frontend Setup
1. Open a terminal in the frontend directory.
2. Install dependencies with `npm install`.
3. Configure the frontend API URL if required.
4. Start the development server with `npm run dev`.

## Environment Variables
Configure the required variables in your local environment. Refer to `.env.example` for the variable names and example placeholders.

Never commit real database passwords, JWT secrets, or API keys.

## Security
- Passwords are stored as hashes, not plaintext.
- Protected endpoints require authentication.
- Role-based access controls restrict privileged operations.
- Clinic tenant checks restrict access across clinic boundaries.
- Public registration creates patient accounts in the configured main clinic.

## Testing
Test authentication, authorization, duplicate registration, password hashing, patient session ownership, and cross-clinic access restrictions. Capture the actual results for submission evidence.

## Repository
GitHub: https://github.com/Raheenfatima068/ClinicBot

## Disclaimer
ClinicBot supports pre-consultation information collection. It is not a substitute for professional medical judgment.
