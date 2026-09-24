from fastapi import FastAPI
from database import test_database_connection

app = FastAPI(
    title="ClinicBot API",
    description="Backend API for the ClinicBot patient intake system",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "ClinicBot API is running"
    }


@app.get("/db-test")
def database_test():
    result = test_database_connection()

    return {
        "database": "connected",
        "test_result": result
    }