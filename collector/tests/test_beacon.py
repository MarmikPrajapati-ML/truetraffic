"""Integration tests for the collector API (TestClient, no real DB needed)."""
from fastapi.testclient import TestClient

from collector.api.main import app

client = TestClient(app, raise_server_exceptions=False)

_FAKE_KEY = "00000000-0000-0000-0000-000000000001"


def _register(domain: str = "test.example.com") -> str:
    r = client.post(f"/sites?domain={domain}")
    return r.json()["site_key"]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_site():
    r = client.post("/sites?domain=acme.com")
    assert r.status_code == 200
    data = r.json()
    assert "site_key" in data
    assert data["domain"] == "acme.com"


def test_beacon_unknown_site_key_returns_404():
    r = client.post("/beacon", json={"site_key": _FAKE_KEY})
    assert r.status_code == 404


def test_beacon_invalid_site_key_rejected():
    r = client.post("/beacon", json={"site_key": "not-a-uuid"})
    assert r.status_code == 422


def test_beacon_extra_fields_rejected():
    site_key = _register()
    r = client.post("/beacon", json={"site_key": site_key, "unknown_field": True})
    assert r.status_code == 422


def test_beacon_headless_classified_as_agent():
    site_key = _register()
    r = client.post("/beacon", json={"site_key": site_key, "webdriver": True})
    assert r.status_code == 200


def test_stats_empty():
    site_key = _register()
    r = client.get(f"/stats/{site_key}")
    assert r.status_code == 200
    data = r.json()
    assert data["total_sessions"] == 0
    assert "note" in data


def test_stats_unknown_key_returns_404():
    r = client.get(f"/stats/{_FAKE_KEY}")
    assert r.status_code == 404


def test_badge_svg_returned():
    site_key = _register()
    r = client.get(f"/badge/{site_key}.svg")
    assert r.status_code == 200
    assert "image/svg+xml" in r.headers["content-type"]
    assert b"<svg" in r.content


def test_badge_invalid_key_returns_400():
    r = client.get("/badge/not-a-uuid.svg")
    assert r.status_code == 400
