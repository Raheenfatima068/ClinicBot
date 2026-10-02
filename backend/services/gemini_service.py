import os

from dotenv import load_dotenv
from google import genai


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not configured")


client = genai.Client(
    api_key=GEMINI_API_KEY
)


def generate_soap_summary(
    chief_complaint: str,
    symptom_duration: str,
    symptoms: list,
    medical_history: list,
    medications: list,
    allergies: list
):
    symptoms_text = ", ".join(symptoms) if symptoms else "None reported"
    history_text = ", ".join(medical_history) if medical_history else "None reported"
    medications_text = ", ".join(medications) if medications else "None reported"
    allergies_text = ", ".join(allergies) if allergies else "None reported"

    prompt = f"""
You are a clinical documentation assistant.

Create a concise SOAP-style clinical summary using ONLY the information
provided below.

Do not diagnose the patient.
Do not recommend treatment.
Do not prescribe medication.
Do not invent or assume information.

Patient intake information:

Chief Complaint:
{chief_complaint}

Symptom Duration:
{symptom_duration}

Symptoms:
{symptoms_text}

Medical History:
{history_text}

Current Medications:
{medications_text}

Allergies:
{allergies_text}

Format the response using these sections:

Subjective:
Objective:
Assessment:
Plan:

For Assessment, only summarize the reported information and state that
clinical assessment is required by the doctor.

For Plan, state that the information should be reviewed by the doctor
during the consultation.
"""

    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
    )

    return response.text