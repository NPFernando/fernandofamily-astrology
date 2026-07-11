import logging

from fastapi.testclient import TestClient

from app.main import app

_DISTINCTIVE_BIRTH_DATE = "1911-11-11"


def test_birth_data_never_appears_in_logs(caplog):
    client = TestClient(app)
    body = {
        "method": "birth_datetime",
        "birth_date": _DISTINCTIVE_BIRTH_DATE,
        "birth_time": "10:34:00",
        "target_date": "2026-07-11",
        "target_time": "12:00:00",
        "location_name": "Colombo, Sri Lanka",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "iana_tz": "Asia/Colombo",
    }
    with caplog.at_level(logging.DEBUG):
        response = client.post("/api/v1/pancha-pakshi/schedule", json=body)
    assert response.status_code == 200
    for record in caplog.records:
        assert _DISTINCTIVE_BIRTH_DATE not in record.getMessage()
        extra = getattr(record, "access_log_fields", None)
        if extra:
            assert _DISTINCTIVE_BIRTH_DATE not in str(extra)
