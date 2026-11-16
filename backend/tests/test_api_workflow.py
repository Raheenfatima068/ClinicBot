
def test_patient_intake_workflow(
    api_client,
    test_clinic,
    test_doctor,
):

    # 1. Register patient
    registration = api_client.post(
        "/auth/register",
        json={
            "full_name": "Workflow Patient",
            "email": "workflow.patient@clinicbot.com",
            "password": "PatientTest@123",
        },
    )

    assert registration.status_code == 200

    # 2. Login patient
    login = api_client.post(
        "/auth/login",
        json={
            "email": "workflow.patient@clinicbot.com",
            "password": "PatientTest@123",
        },
    )

    assert login.status_code == 200

    patient_token = login.json()["access_token"]

    patient_headers = {
        "Authorization": f"Bearer {patient_token}"
    }

    # 3. Create intake session
    intake = api_client.post(
        "/intake/sessions",
        params={
            "chief_complaint": "Severe headache",
            "symptom_duration": "2 days",
        },
        headers=patient_headers,
    )

    assert intake.status_code == 200

    intake_data = intake.json()

    assert intake_data["chief_complaint"] == "Severe headache"
    assert intake_data["symptom_duration"] == "2 days"
    assert intake_data["status"] == "active"
    assert intake_data["assigned_doctor_id"] == test_doctor

    # 4. Retrieve patient's intake history
    history = api_client.get(
        "/intake/sessions",
        headers=patient_headers,
    )

    assert history.status_code == 200
    assert len(history.json()) == 1

    assert history.json()[0]["chief_complaint"] == "Severe headache"

    # 5. Verify doctor can log in
    doctor_login = api_client.post(
        "/auth/login",
        json={
            "email": "doctor.test@clinicbot.com",
            "password": "DoctorTest@123",
        },
    )

    assert doctor_login.status_code == 200
    assert doctor_login.json()["token_type"] == "bearer"
