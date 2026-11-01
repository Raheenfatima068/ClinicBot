
import logging
import os
from typing import Any

from dotenv import load_dotenv
from google import genai

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

# Do not prevent FastAPI from starting when the API key is missing.
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None


def _to_text_list(values: Any) -> list[str]:
    """Convert optional intake values into safe, readable strings."""
    if not values:
        return []

    if isinstance(values, str):
        return [values.strip()] if values.strip() else []

    if not isinstance(values, (list, tuple, set)):
        return [str(values).strip()]

    result = []

    for item in values:
        if item is None:
            continue

        if isinstance(item, dict):
            # Support common symptom/history object shapes.
            value = (
                item.get("name")
                or item.get("description")
                or item.get("value")
                or item.get("details")
            )
            if value:
                result.append(str(value).strip())
        else:
            value = str(item).strip()
            if value:
                result.append(value)

    return result


def _format_items(values: list[str]) -> str:
    return ", ".join(values) if values else "None reported"


def _fallback_summary(
    chief_complaint: str,
    symptom_duration: str,
    symptoms: list[str],
    medical_history: list[str],
    medications: list[str],
    allergies: list[str],
) -> str:
    """
    Produce a clearly labelled, non-AI fallback using only supplied data.
    This is documentation support, not a clinical assessment.
    """
    return f"""AI SUMMARY UNAVAILABLE — FALLBACK DRAFT

This draft was assembled from the information supplied by the patient.
It was not generated or verified by Gemini. A doctor must review it.

Subjective:
Chief complaint: {chief_complaint or "Not provided"}.
Reported symptom duration: {symptom_duration or "Not provided"}.
Reported symptoms: {_format_items(symptoms)}.
Medical history: {_format_items(medical_history)}.
Current medications: {_format_items(medications)}.
Reported allergies: {_format_items(allergies)}.

Objective:
No objective examination findings were supplied in the patient intake information.

Assessment:
An AI-generated assessment is unavailable. Clinical assessment by a qualified
doctor is required. No diagnosis has been made by this fallback.

Plan:
A doctor should review the patient's reported information, verify relevant
medical history, medications and allergies, and complete the consultation.
"""


def generate_soap_summary(
    chief_complaint: str,
    symptom_duration: str,
    symptoms: list,
    medical_history: list,
    medications: list,
    allergies: list,
) -> str:
    """
    Generate a draft SOAP-style summary with Gemini.

    The function keeps the existing interface so existing router calls
    can continue to use it. If AI generation is unavailable, it returns
    a clearly labelled fallback rather than inventing clinical findings.
    """
    complaint = str(chief_complaint or "").strip() or "Not provided"
    duration = str(symptom_duration or "").strip() or "Not provided"

    symptoms_list = _to_text_list(symptoms)
    history_list = _to_text_list(medical_history)
    medications_list = _to_text_list(medications)
    allergies_list = _to_text_list(allergies)

    fallback = _fallback_summary(
        chief_complaint=complaint,
        symptom_duration=duration,
        symptoms=symptoms_list,
        medical_history=history_list,
        medications=medications_list,
        allergies=allergies_list,
    )

    if client is None:
        logger.error(
            "Gemini summary unavailable because GEMINI_API_KEY is not configured."
        )
        return fallback

    prompt = f"""
You are a clinical documentation assistant.

Create a concise draft SOAP-style summary using ONLY the information
provided below.

STRICT RULES:
- Do not diagnose the patient.
- Do not recommend treatment or prescribe medication.
- Do not invent, infer, or assume information.
- Do not present patient-reported information as an examination finding.
- Clearly state when objective findings were not provided.
- Assessment must state that a qualified doctor must perform the clinical
  assessment.
- Plan must state that the doctor should review the information.
- Preserve uncertainty and relevant patient-reported details.
- Do not claim that a doctor has already reviewed or approved the summary.

Patient intake information:

Chief Complaint:
{complaint}

Symptom Duration:
{duration}

Symptoms:
{_format_items(symptoms_list)}

Medical History:
{_format_items(history_list)}

Current Medications:
{_format_items(medications_list)}

Allergies:
{_format_items(allergies_list)}

Use exactly these sections:

Subjective:
Objective:
Assessment:
Plan:

This is a draft for clinician review, not a diagnosis or treatment plan.
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )

        generated_text = getattr(response, "text", None)

        if not isinstance(generated_text, str) or not generated_text.strip():
            logger.warning("Gemini returned an empty summary.")
            return fallback

        return (
            "AI-GENERATED DRAFT — REQUIRES DOCTOR REVIEW\n\n"
            + generated_text.strip()
        )

    except Exception:
        # Log the technical error on the server, without exposing API
        # credentials or internal provider details to the patient.
        logger.exception("Gemini summary generation failed.")
        return fallback
