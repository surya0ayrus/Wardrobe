from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import ActivityLog, User


def count_logs(**filters) -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count()).select_from(ActivityLog).filter_by(**filters))


def test_login_with_username_or_email_in_any_case(t):
    user = t.make_user(username="ravi")
    r = t.client.post("/api/auth/login", json={"login": "RAVI", "password": "Secret@123"})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "ravi"
    assert r.json()["current_company_id"] == t.main_id

    assert t.client.post("/api/auth/logout").status_code == 200
    assert t.client.get("/api/auth/me").status_code == 401

    r = t.client.post("/api/auth/login", json={"login": user.email.upper(), "password": "Secret@123"})
    assert r.status_code == 200


def test_wrong_password_and_inactive_account_are_rejected(t):
    t.make_user(username="ravi")
    t.make_user(username="off", is_active=False)

    r = t.client.post("/api/auth/login", json={"login": "ravi", "password": "wrong"})
    assert r.status_code == 422 and "login" in r.json()["errors"]
    assert count_logs(action="login_failed", loggable_type="user") == 1

    r = t.client.post("/api/auth/login", json={"login": "off", "password": "Secret@123"})
    assert r.status_code == 422 and "login" in r.json()["errors"]


def test_login_is_throttled(t):
    for _ in range(5):
        t.client.post("/api/auth/login", json={"login": "nobody", "password": "x"})
    assert t.client.post("/api/auth/login", json={"login": "nobody", "password": "x"}).status_code == 429


def test_users_change_their_own_password(t):
    c = t.acting_as(t.make_user())
    r = c.put("/api/auth/password", json={"current_password": "Secret@123", "password": "NewPass123",
                                           "password_confirmation": "NewPass123"})
    assert r.status_code == 200
    bad = c.put("/api/auth/password", json={"current_password": "NewPass123", "password": "short",
                                             "password_confirmation": "x"})
    assert bad.status_code == 422 and len(bad.json()["errors"]["password"]) >= 2


def test_a_new_login_must_change_password_before_anything_else(t):
    c = t.acting_as(t.make_user(["view_user"], is_first_login=True))

    r = c.get("/api/users")
    assert r.status_code == 403 and r.json()["code"] == "password_change_required"
    assert c.get("/api/auth/me").json()["user"]["must_change_password"] is True

    r = c.put("/api/auth/password", json={"current_password": "Secret@123", "password": "NewPass123",
                                           "password_confirmation": "NewPass123"})
    assert r.status_code == 200 and r.json()["user"]["must_change_password"] is False
    assert c.get("/api/users").status_code == 200


def test_members_of_two_companies_can_switch(t):
    both = t.make_user(companies=[t.main, t.other])
    r = t.acting_as(both).put("/api/auth/company", json={"company_id": t.other_id})
    assert r.status_code == 200 and r.json()["current_company_id"] == t.other_id


def test_cannot_switch_to_a_company_you_do_not_belong_to(t):
    r = t.acting_as(t.make_user()).put("/api/auth/company", json={"company_id": t.other_id})
    assert r.status_code == 403


def test_deactivated_user_is_blocked_on_next_request(t):
    user = t.make_user()
    with SessionLocal() as db:
        db.get(User, user.id).is_active = False
        db.commit()
    assert t.acting_as(user).get("/api/auth/me").status_code == 403


def test_preferences_default_and_can_be_changed(t):
    c = t.acting_as(t.make_user())
    assert c.get("/api/auth/me").json()["preferences"] == {"nav_style": "top", "theme": "system"}

    r = c.put("/api/auth/preferences", json={"theme": "dark"})
    assert r.json()["preferences"] == {"nav_style": "top", "theme": "dark"}
    r = c.put("/api/auth/preferences", json={"nav_style": "side"})
    assert r.json()["preferences"] == {"nav_style": "side", "theme": "dark"}

    assert c.put("/api/auth/preferences", json={"theme": "purple"}).status_code == 422
    assert count_logs(action="updated", loggable_type="user") == 0


def test_saved_times_match_the_real_clock(t):
    from datetime import datetime, timezone
    user = t.make_user()
    with SessionLocal() as db:
        u = db.get(User, user.id)
        log = db.scalars(select(ActivityLog).order_by(ActivityLog.id.desc())).first()
        now = datetime.now(timezone.utc)
        assert abs((now - u.created_at).total_seconds()) < 5
        assert abs((now - log.created_at).total_seconds()) < 5


def test_csrf_and_session_cookie_flow(t, monkeypatch):
    """Outside the test environment the React app's CSRF handshake is enforced."""
    from app.config import settings
    monkeypatch.setattr(settings, "app_env", "local")
    t.make_user(username="ravi")
    body = {"login": "ravi", "password": "Secret@123"}

    assert t.client.post("/api/auth/login", json=body).status_code == 419
    assert t.client.get("/sanctum/csrf-cookie").status_code == 204
    token = t.client.cookies.get("XSRF-TOKEN")
    assert token
    r = t.client.post("/api/auth/login", json=body, headers={"X-XSRF-TOKEN": token})
    assert r.status_code == 200
    token = t.client.cookies.get("XSRF-TOKEN")
    assert t.client.get("/api/auth/me").status_code == 200
    assert t.client.post("/api/auth/logout").status_code == 419
    assert t.client.post("/api/auth/logout", headers={"X-XSRF-TOKEN": token}).status_code == 200
    assert t.client.get("/api/auth/me").status_code == 401
