
def test_patient_registration(api_client, test_clinic):

    payload = {
        "full_name": "Test Patient",
        "email": "patient.test@clinicbot.com",
        "password": "PatientTest@123",
    }

    response = api_client.post(
        "/auth/register",
        json=payload,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["full_name"] == "Test Patient"
    assert data["email"] == "patient.test@clinicbot.com"
    assert data["role"] == "patient"
    assert data["tenant_id"] == test_clinic


def test_patient_login(api_client, test_clinic):

    registration = {
        "full_name": "Login Patient",
        "email": "login.patient@clinicbot.com",
        "password": "PatientTest@123",
    }

    register_response = api_client.post(
        "/auth/register",
        json=registration,
    )

    assert register_response.status_code == 200

    login_response = api_client.post(
        "/auth/login",
        json={
            "email": registration["email"],
            "password": registration["password"],
        },
    )

    assert login_response.status_code == 200

    data = login_response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"

    headers = {
        "Authorization": f"Bearer {data['access_token']}"
    }

    profile_response = api_client.get(
        "/auth/me",
        headers=headers,
    )

    assert profile_response.status_code == 200
    assert profile_response.json()["email"] == registration["email"]


def test_login_with_wrong_password(api_client, test_clinic):

    api_client.post(
        "/auth/register",
        json={
            "full_name": "Wrong Password Patient",
            "email": "wrong.password@clinicbot.com",
            "password": "PatientTest@123",
        },
    )

    response = api_client.post(
        "/auth/login",
        json={
            "email": "wrong.password@clinicbot.com",
            "password": "WrongPassword@123",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"
