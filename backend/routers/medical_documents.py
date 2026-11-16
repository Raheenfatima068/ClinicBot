
from pathlib import Path
from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from database import get_db
from models import User, MedicalDocument
from dependencies import get_current_user

from routers.medical_history import (
    get_patient_session,
    require_current_consent,
)


router = APIRouter(
    prefix="/intake",
    tags=["Medical Documents"],
)

logger = logging.getLogger("clinicbot.medical_documents")

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

# Private storage directory: outside the frontend's public directory.
UPLOAD_DIRECTORY = (
    Path(__file__).resolve().parents[1]
    / "private_medical_documents"
)

ALLOWED_TYPES = {
    ".pdf": {
        "content_type": "application/pdf",
        "signature": b"%PDF-",
    },
    ".jpg": {
        "content_type": "image/jpeg",
        "signature": b"\xff\xd8\xff",
    },
    ".jpeg": {
        "content_type": "image/jpeg",
        "signature": b"\xff\xd8\xff",
    },
    ".png": {
        "content_type": "image/png",
        "signature": b"\x89PNG\r\n\x1a\n",
    },
}


def validate_file(filename: str, content_type: str | None, data: bytes):
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Only PDF, JPEG, and PNG files are allowed.",
        )

    expected = ALLOWED_TYPES[extension]

    if content_type != expected["content_type"]:
        raise HTTPException(
            status_code=415,
            detail="The file extension and content type do not match.",
        )

    if not data.startswith(expected["signature"]):
        raise HTTPException(
            status_code=415,
            detail="The uploaded file does not match its declared file type.",
        )

    # Reject empty files and files that contain only a file signature.
    if len(data) <= len(expected["signature"]):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty or incomplete.",
        )

    return extension, expected["content_type"]


def safe_original_filename(filename: str | None) -> str:
    """Keep a display name, never use it as a storage path."""

    name = Path(filename or "medical_document").name
    name = "".join(
        char for char in name
        if char.isprintable() and char not in "\r\n"
    ).strip()

    return name[:255] or "medical_document"


def document_response(document: MedicalDocument) -> dict:
    """Do not expose the private storage filename."""

    return {
        "id": document.id,
        "intake_session_id": document.intake_session_id,
        "uploaded_by_user_id": document.uploaded_by_user_id,
        "original_filename": document.original_filename,
        "content_type": document.content_type,
        "file_size": document.file_size,
        "uploaded_at": document.uploaded_at,
    }


# --------------------------------------------------
# UPLOAD A MEDICAL DOCUMENT
# --------------------------------------------------

@router.post("/sessions/{session_id}/documents", status_code=201)
async def upload_medical_document(
    session_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)
    require_current_consent(current_user, db)

    original_filename = safe_original_filename(file.filename)

    try:
        # Read at most 5 MB plus one byte to detect oversized files.
        data = await file.read(MAX_FILE_SIZE + 1)

        if not data:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty.",
            )

        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File exceeds the maximum size of 5 MB.",
            )

        extension, verified_content_type = validate_file(
            original_filename,
            file.content_type,
            data,
        )

        UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

        # The generated filename prevents path traversal and collisions.
        stored_filename = f"{uuid4().hex}{extension}"
        destination = UPLOAD_DIRECTORY / stored_filename

        try:
            with destination.open("xb") as output:
                output.write(data)

            document = MedicalDocument(
                intake_session_id=session_id,
                uploaded_by_user_id=current_user.id,
                original_filename=original_filename,
                stored_filename=stored_filename,
                content_type=verified_content_type,
                file_size=len(data),
            )

            db.add(document)
            db.commit()
            db.refresh(document)

        except Exception:
            db.rollback()

            # Remove the saved file if the database write failed.
            if destination.exists():
                destination.unlink()

            raise

        return document_response(document)

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        logger.exception("Database error while saving medical document")
        raise HTTPException(
            status_code=500,
            detail="Unable to save the medical document.",
        ) from exc

    except OSError as exc:
        logger.exception("Storage error while saving medical document")
        raise HTTPException(
            status_code=500,
            detail="Unable to store the medical document.",
        ) from exc

    finally:
        await file.close()


# --------------------------------------------------
# LIST DOCUMENTS FOR AN INTAKE SESSION
# --------------------------------------------------

@router.get("/sessions/{session_id}/documents")
def list_medical_documents(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)
    require_current_consent(current_user, db)

    documents = (
        db.query(MedicalDocument)
        .filter(
            MedicalDocument.intake_session_id == session_id
        )
        .order_by(MedicalDocument.id)
        .all()
    )

    return [document_response(doc) for doc in documents]


# --------------------------------------------------
# DOWNLOAD A DOCUMENT
# --------------------------------------------------

@router.get(
    "/sessions/{session_id}/documents/{document_id}/download"
)
def download_medical_document(
    session_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_patient_session(session_id, current_user, db)
    require_current_consent(current_user, db)

    document = (
        db.query(MedicalDocument)
        .filter(
            MedicalDocument.id == document_id,
            MedicalDocument.intake_session_id == session_id,
            MedicalDocument.uploaded_by_user_id == current_user.id,
        )
        .first()
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Medical document not found.",
        )

    # Only use the server-generated storage name.
    if (
        not document.stored_filename
        or Path(document.stored_filename).name != document.stored_filename
    ):
        raise HTTPException(
            status_code=404,
            detail="Medical document not found.",
        )

    path = UPLOAD_DIRECTORY / document.stored_filename

    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The stored medical document could not be found.",
        )

    return FileResponse(
        path=path,
        media_type=document.content_type,
        filename=document.original_filename,
        content_disposition_type="attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )
