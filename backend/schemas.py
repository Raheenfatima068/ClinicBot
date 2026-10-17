
from typing import Literal
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator

class UserRegister(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=72)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name is required.")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError(
                "Password must not exceed 72 UTF-8 bytes."
            )
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    tenant_id: int | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


# ============================================================
# Clinical Summary Review
# ============================================================

class ClinicalSummaryReview(BaseModel):
    review_status: Literal["pending", "reviewed", "approved"]
    doctor_notes: str | None = Field(default=None, max_length=5000)

    @field_validator("review_status", mode="before")
    @classmethod
    def normalize_review_status(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("doctor_notes")
    @classmethod
    def trim_doctor_notes(cls, value):
        if value is not None:
            return value.strip()
        return value
