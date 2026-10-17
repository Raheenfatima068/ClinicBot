
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from models import User
from routers.auth import router as auth_router
from routers.patient import router as patient_router
from routers.intake import router as intake_router
from routers.symptoms import router as symptoms_router
from routers.medical_history import router as medical_history_router
from routers.medications import router as medications_router
from routers.allergies import router as allergies_router
from routers.conversation import router as conversation_router
from routers.ai import router as ai_router
from routers.doctor import router as doctor_router
from routers.admin import router as admin_router


# Configure application logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("clinicbot")

app = FastAPI(
    title="ClinicBot API",
    description="Pre-Consultation Patient Intake & Symptom Summary Portal",
    version="1.0.0"
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global handler for unexpected server errors
@app.exception_handler(Exception)
async def unexpected_exception_handler(
    request: Request,
    exc: Exception
):
    logger.exception(
        "Unexpected error while processing %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected server error occurred. Please try again later."
        },
    )


# Create database tables
Base.metadata.create_all(bind=engine)


# Register API routers
app.include_router(auth_router)
app.include_router(patient_router)
app.include_router(intake_router)
app.include_router(symptoms_router)
app.include_router(medical_history_router)
app.include_router(medications_router)
app.include_router(allergies_router)
app.include_router(conversation_router)
app.include_router(ai_router)
app.include_router(doctor_router)
app.include_router(admin_router)


@app.get("/")
def root():
    return {
        "message": "ClinicBot API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
