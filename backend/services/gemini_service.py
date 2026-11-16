
import logging
import os
import time
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv(
    "GEMINI_MODEL",
    "gemini-3.5-flash"
).strip()

MAX_ATTEMPTS = 3
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
REQUEST_TIMEOUT_MS = 30000

# Do not prevent FastAPI from starting if the API key is missing.
client = (
    genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(
            timeout=REQUEST_TIMEOUT_MS
        ),
    )
    if GEMINI_API_KEY
    else None
)


# --------------------------------------------------
# INPUT FORMATTING
# --------------------------------------------------

def _to_text_list(values: Any) -> list[str]:
    """Convert optional intake values into safe, readable strings."""

    if not values:
        return []

    if isinstance(values, str):
        return [values.strip()] if values.strip() else []

    if not isinstance(values, (list, tuple, set)):
        value = str(values).strip()
        return [value] if value else []

    result = []

    for item in values:
        if item is None:
            continue

        if isinstance(item, dict):
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


# --------------------------------------------------
# ERROR HANDLING
# --------------------------------------------------

def _get_status_code(error: Exception):
    """Extract an HTTP status code from a Gemini SDK exception."""

    for attribute in ("code", "status_code"):
        value = getattr(error, attribute, None)

        if isinstance(value, int):
            return value

    response = getattr(error, "response", None)
    value = getattr(response, "status_code", None)

    if isinstance(value, int):
        return value

    return None


def _is_timeout_error(error: Exception) -> bool:
    """Identify common timeout exceptions."""

    error_name = error.__class__.__name__.lower()

    return "timeout" in error_name or "timedout" in error_name


def _is_connection_error(error: Exception) -> bool:
    """Identify temporary connection-related errors."""

    error_name = error.__class__.__name__.lower()

    connection_errors = (
        "connectionerror",
        "connecterror",
        "connectionreset",
        "networkerror",
    )

    return any(
        name in error_name
        for name in connection_errors
    )


# --------------------------------------------------
# FALLBACK SUMMARY
# --------------------------------------------------

def _fallback_summary(
    chief_complaint: str,
    symptom_duration: str,
    symptoms: list[str],
    medical_history: list[str],
    medications: list[str],
    allergies: list[str],
) -> str:
    """Create a clearly labelled non-AI draft."""

    return f"""AI SUMMARY UNAVAILABLE - FALLBACK DRAFT

This draft was assembled from information supplied by the patient.
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


# --------------------------------------------------
# GEMINI SOAP SUMMARY GENERATION
# --------------------------------------------------

def generate_soap_summary(
    chief_complaint: str,
    symptom_duration: str,
    symptoms: list,
    medical_history: list,
    medications: list,
    allergies: list,
) -> str:
    """Generate a draft SOAP summary with retries and safe fallback."""

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

    # Handle missing API key.
    if client is None:
        logger.error(
            "Gemini unavailable: GEMINI_API_KEY is not configured."
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
- Do not claim that a doctor has reviewed or approved the summary.

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

    # Retry temporary API failures.
    for attempt in range(1, MAX_ATTEMPTS + 1):

        try:
            logger.info(
                "Gemini generation attempt %s/%s using model %s.",
                attempt,
                MAX_ATTEMPTS,
                GEMINI_MODEL,
            )

            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
            )

            generated_text = getattr(response, "text", None)

            if (
                not isinstance(generated_text, str)
                or not generated_text.strip()
            ):
                logger.warning(
                    "Gemini returned an empty summary."
                )
                return fallback

            logger.info(
                "Gemini successfully generated the clinical summary."
            )

            return (
                "AI-GENERATED DRAFT - REQUIRES DOCTOR REVIEW\n\n"
                + generated_text.strip()
            )

        except Exception as error:

            status_code = _get_status_code(error)
            is_timeout = _is_timeout_error(error)
            is_connection_error = _is_connection_error(error)

            should_retry = (
                status_code in RETRYABLE_STATUS_CODES
                or is_timeout
                or is_connection_error
            )

            if should_retry and attempt < MAX_ATTEMPTS:

                wait_seconds = 2 ** attempt

                logger.warning(
                    "Temporary Gemini error (HTTP %s, timeout=%s, "
                    "connection_error=%s). Retrying in %s seconds. "
                    "Attempt %s/%s.",
                    status_code,
                    is_timeout,
                    is_connection_error,
                    wait_seconds,
                    attempt,
                    MAX_ATTEMPTS,
                )

                time.sleep(wait_seconds)
                continue

            logger.exception(
                "Gemini summary generation failed. "
                "HTTP status: %s. Timeout: %s. "
                "Connection error: %s. Attempt: %s/%s.",
                status_code,
                is_timeout,
                is_connection_error,
                attempt,
                MAX_ATTEMPTS,
            )

            return fallback

    return fallback
