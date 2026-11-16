
def test_root_endpoint(api_client):
    response = api_client.get("/")

    assert response.status_code == 200
    assert response.json()["message"] == "ClinicBot API is running"


def test_health_endpoint(api_client):
    response = api_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
