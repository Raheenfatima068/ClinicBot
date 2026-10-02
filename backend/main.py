from fastapi import FastAPI

from database import Base, engine
from models import User
from routers.auth import router as auth_router
from routers.patient import router as patient_router
from routers.intake import router as intake_router
from routers.symptoms import router as symptoms_router
from routers.medical_history import router as medical_history_router
from routers.medications import router as medications_router
from routers.allergies import router as allergies_router

app = FastAPI(
    title="ClinicBot API",
    description="Pre-Consultation Patient Intake & Symptom Summary Portal",
    version="1.0.0"
)


Base.metadata.create_all(bind=engine)


app.include_router(auth_router)
app.include_router(patient_router)
app.include_router(intake_router)
app.include_router(symptoms_router)
app.include_router(medical_history_router)
app.include_router(medications_router)
app.include_router(allergies_router)

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