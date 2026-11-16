
from types import SimpleNamespace
from unittest.mock import Mock

from services import gemini_service


def sample_inputs():
    return {
        "chief_complaint": "Headache",
        "symptom_duration": "2 days",
        "symptoms": ["Headache", "Dizziness"],
        "medical_history": ["Asthma"],
        "medications": ["None"],
        "allergies": ["None reported"],
    }


def fake_client(side_effect):
    generate_content = Mock(side_effect=side_effect)

    client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=generate_content
        )
    )

    return client, generate_content


def test_gemini_success_on_first_attempt(monkeypatch):
    response = SimpleNamespace(
        text="Subjective:\nHeadache for two days."
    )

    client, generate = fake_client([response])

    monkeypatch.setattr(gemini_service, "client", client)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI-GENERATED DRAFT" in result
    assert "Headache for two days" in result
    assert generate.call_count == 1


def test_gemini_retries_after_http_503(monkeypatch):
    class HTTPError(Exception):
        code = 503

    response = SimpleNamespace(
        text="Subjective:\nPatient reports headache."
    )

    client, generate = fake_client([
        HTTPError("Temporary server error"),
        response,
    ])

    sleep_mock = Mock()

    monkeypatch.setattr(gemini_service, "client", client)
    monkeypatch.setattr(gemini_service.time, "sleep", sleep_mock)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI-GENERATED DRAFT" in result
    assert generate.call_count == 2
    sleep_mock.assert_called_once_with(2)


def test_gemini_retries_after_timeout(monkeypatch):
    class ReadTimeoutError(Exception):
        pass

    response = SimpleNamespace(
        text="Subjective:\nPatient reports headache."
    )

    client, generate = fake_client([
        ReadTimeoutError("Request timed out"),
        response,
    ])

    sleep_mock = Mock()

    monkeypatch.setattr(gemini_service, "client", client)
    monkeypatch.setattr(gemini_service.time, "sleep", sleep_mock)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI-GENERATED DRAFT" in result
    assert generate.call_count == 2
    sleep_mock.assert_called_once_with(2)


def test_gemini_retries_after_connection_error(monkeypatch):
    response = SimpleNamespace(
        text="Subjective:\nPatient reports headache."
    )

    client, generate = fake_client([
        ConnectionResetError("Connection reset"),
        response,
    ])

    sleep_mock = Mock()

    monkeypatch.setattr(gemini_service, "client", client)
    monkeypatch.setattr(gemini_service.time, "sleep", sleep_mock)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI-GENERATED DRAFT" in result
    assert generate.call_count == 2
    sleep_mock.assert_called_once_with(2)


def test_gemini_returns_fallback_after_all_attempts_fail(monkeypatch):
    class HTTPError(Exception):
        code = 503

    client, generate = fake_client([
        HTTPError("Server error"),
        HTTPError("Server error"),
        HTTPError("Server error"),
    ])

    sleep_mock = Mock()

    monkeypatch.setattr(gemini_service, "client", client)
    monkeypatch.setattr(gemini_service.time, "sleep", sleep_mock)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI SUMMARY UNAVAILABLE" in result
    assert "Headache" in result
    assert generate.call_count == 3
    assert sleep_mock.call_count == 2


def test_gemini_returns_fallback_when_api_key_is_missing(monkeypatch):
    monkeypatch.setattr(gemini_service, "client", None)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI SUMMARY UNAVAILABLE" in result
    assert "Headache" in result


def test_gemini_returns_fallback_for_empty_response(monkeypatch):
    response = SimpleNamespace(text="")

    client, generate = fake_client([response])

    monkeypatch.setattr(gemini_service, "client", client)

    result = gemini_service.generate_soap_summary(
        **sample_inputs()
    )

    assert "AI SUMMARY UNAVAILABLE" in result
    assert generate.call_count == 1
