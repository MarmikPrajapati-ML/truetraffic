"""Phase 4 tests — Crawler Watch: subscribe, unsubscribe, sync, email gating."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from collector.api.db import Base
from collector.api.main import app, get_db
from collector.api.models import CrawlerChangelog, CrawlerSnapshot, Subscriber


@pytest.fixture()
def db_session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/test.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── subscribe / unsubscribe ───────────────────────────────────────────────────

def test_subscribe_creates_subscriber(client, db_session):
    resp = client.post("/crawlerwatch/subscribe", json={"email": "test@example.com"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert db_session.query(Subscriber).filter_by(email="test@example.com").count() == 1


def test_subscribe_duplicate_is_idempotent(client, db_session):
    client.post("/crawlerwatch/subscribe", json={"email": "dupe@example.com"})
    resp = client.post("/crawlerwatch/subscribe", json={"email": "dupe@example.com"})
    assert resp.status_code == 200
    assert db_session.query(Subscriber).filter_by(email="dupe@example.com").count() == 1


def test_subscribe_rejects_invalid_email(client):
    resp = client.post("/crawlerwatch/subscribe", json={"email": "not-an-email"})
    assert resp.status_code == 422


def test_unsubscribe_removes_subscriber(client, db_session):
    client.post("/crawlerwatch/subscribe", json={"email": "unsub@example.com"})
    sub = db_session.query(Subscriber).filter_by(email="unsub@example.com").first()
    token = sub.unsubscribe_token

    resp = client.get(f"/crawlerwatch/unsubscribe/{token}")
    assert resp.status_code == 200
    assert "unsubscribed" in resp.text.lower()
    assert db_session.query(Subscriber).filter_by(email="unsub@example.com").count() == 0


def test_unsubscribe_unknown_token_is_graceful(client):
    resp = client.get("/crawlerwatch/unsubscribe/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 200
    assert "no longer valid" in resp.text.lower()


# ── sync / diff ───────────────────────────────────────────────────────────────

def test_sync_initial_snapshot_no_email(monkeypatch, db_session):
    """First sync creates snapshot but sends no email (no prior diff to detect)."""
    emails_sent = []

    monkeypatch.setattr(
        "collector.api.crawlerwatch.send_email",
        lambda *a, **kw: emails_sent.append(a) or False,
    )

    upstream = ["GPTBot", "ClaudeBot"]

    from collector.api.crawlerwatch import do_sync
    result = do_sync(db_session, fetch_fn=lambda url: _fake_robots(upstream))

    assert db_session.query(CrawlerSnapshot).count() == 1
    assert result["added"] == []
    assert len(emails_sent) == 0


def test_sync_detects_new_crawler(monkeypatch, db_session):
    """When upstream adds a new agent, a changelog entry is created."""
    monkeypatch.setattr(
        "collector.api.crawlerwatch.send_email",
        lambda *a, **kw: False,
    )

    from collector.api.crawlerwatch import do_sync

    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))
    result = do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot", "NewBot"]))

    assert "NewBot" in result["added"]
    assert db_session.query(CrawlerChangelog).count() == 1
    entry = db_session.query(CrawlerChangelog).first()
    assert "NewBot" in json.loads(entry.added_json)


def test_sync_notifies_subscribers_on_new_crawler(monkeypatch, db_session):
    """Emails are sent to subscribers when new crawlers appear."""
    emails_sent: list[tuple] = []
    monkeypatch.setattr(
        "collector.api.crawlerwatch.send_email",
        lambda to, subj, body: emails_sent.append((to, subj)) or True,
    )

    db_session.add(Subscriber(email="watcher@example.com"))
    db_session.commit()

    from collector.api.crawlerwatch import do_sync
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot", "AnotherBot"]))

    assert len(emails_sent) == 1
    assert emails_sent[0][0] == "watcher@example.com"
    assert "AnotherBot" in emails_sent[0][1] or "crawler" in emails_sent[0][1].lower()


def test_no_email_without_optin(monkeypatch, db_session):
    """Email must never be sent when there are no subscribers."""
    emails_sent: list = []
    monkeypatch.setattr(
        "collector.api.crawlerwatch.send_email",
        lambda *a, **kw: emails_sent.append(a) or True,
    )

    from collector.api.crawlerwatch import do_sync
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot", "NewBot"]))

    assert len(emails_sent) == 0, "Email sent without any subscribers — H8 violation"


def test_sync_idempotent_same_day(monkeypatch, db_session):
    """Calling sync twice on the same day overwrites snapshot, no duplicate changelog."""
    monkeypatch.setattr("collector.api.crawlerwatch.send_email", lambda *a, **kw: False)
    from collector.api.crawlerwatch import do_sync

    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))

    assert db_session.query(CrawlerSnapshot).count() == 1
    assert db_session.query(CrawlerChangelog).count() == 0


# ── changelog endpoint ────────────────────────────────────────────────────────

def test_changelog_endpoint(monkeypatch, client, db_session):
    monkeypatch.setattr("collector.api.crawlerwatch.send_email", lambda *a, **kw: False)
    from collector.api.crawlerwatch import do_sync

    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot"]))
    do_sync(db_session, fetch_fn=lambda url: _fake_robots(["GPTBot", "BrandNewBot"]))

    resp = client.get("/crawlerwatch/changelog")
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) >= 1
    assert "BrandNewBot" in entries[0]["added"]


# ── helpers ───────────────────────────────────────────────────────────────────

def _fake_robots(tokens: list[str]) -> str:
    lines = []
    for t in tokens:
        lines += [f"User-agent: {t}", "Disallow: /\n"]
    return "\n".join(lines)
