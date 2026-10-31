from sqlalchemy import func, select

from app.config import settings
from app.db import SessionLocal
from app.models import ActivityLog, Role, User
from app.security import check_password


def rid(name):
    with SessionLocal() as db:
        return db.scalar(select(Role.id).where(Role.name == name))


def payload(t, **over):
    return {"name": "Ravi Kumar", "username": "Ravi.K", "email": "Ravi@Example.com",
            "role_ids": [rid("User")], "company_ids": [t.main_id], **over}


def test_admin_creates_a_login_with_the_default_password(t):
    r = t.acting_as(t.make_user(["create_user"])).post("/api/users", json=payload(t))
    assert r.status_code == 201
    d = r.json()["data"]
    assert (d["username"], d["email"], d["is_first_login"]) == ("ravi.k", "ravi@example.com", True)
    assert d["companies"][0]["short_name"] == "MAIN"

    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.username == "ravi.k")).one()
        assert check_password(settings.app_default_password, user.password)
        assert user.role_names() == ["User"] and user.current_company_id == t.main_id


def test_duplicate_username_is_rejected_in_any_case(t):
    c = t.acting_as(t.make_user(["create_user"]))
    assert c.post("/api/users", json=payload(t)).status_code == 201
    r = c.post("/api/users", json=payload(t, username="RAVI.K", email=None))
    assert r.status_code == 422 and "username" in r.json()["errors"]


def test_cannot_add_users_to_a_company_you_cannot_reach(t):
    r = t.acting_as(t.make_user(["create_user"])).post("/api/users", json=payload(t, company_ids=[t.other_id]))
    assert r.status_code == 422 and "company_ids" in r.json()["errors"]


def test_needs_the_permission_and_only_super_admin_gives_super_admin_or_admin(t):
    for role in ("SuperAdmin", "Admin"):
        body = payload(t, role_ids=[rid(role)])
        assert t.acting_as(t.make_user(["view_user"])).post("/api/users", json=body).status_code == 403
        assert t.acting_as(t.make_user(["create_user"])).post("/api/users", json=body).status_code == 403
    r = t.acting_as(t.make_super_admin()).post("/api/users", json=payload(t, role_ids=[rid("Admin")]))
    assert r.status_code == 201


def test_editing_keeps_companies_the_editor_cannot_see(t):
    person = t.make_user(companies=[t.main, t.other])
    c = t.acting_as(t.make_user(["update_user"]))
    r = c.put(f"/api/users/{person.id}", json=payload(t, name="Renamed", username=person.username, email=None))
    assert r.status_code == 200 and r.json()["data"]["name"] == "Renamed"

    with SessionLocal() as db:
        assert {c.id for c in db.get(User, person.id).companies} == {t.main_id, t.other_id}
        assert db.scalar(select(func.count()).select_from(ActivityLog).filter_by(
            action="updated", loggable_type="user", loggable_id=person.id)) == 1


def test_users_of_other_companies_are_not_visible(t):
    outsider = t.make_user(companies=[t.other])
    c = t.acting_as(t.make_user(["view_user", "update_user"]))
    assert c.get(f"/api/users/{outsider.id}").status_code == 404
    assert len(c.get("/api/users").json()["data"]) == 1


def test_reset_password_forces_a_change_at_next_login(t):
    person = t.make_user()
    assert t.acting_as(t.make_user(["update_user"])).post(f"/api/users/{person.id}/reset-password").status_code == 200
    with SessionLocal() as db:
        p = db.get(User, person.id)
        assert p.is_first_login and check_password(settings.app_default_password, p.password)
        assert db.scalar(select(func.count()).select_from(ActivityLog).filter_by(
            action="password_reset", loggable_id=person.id)) == 1


def test_cannot_deactivate_yourself(t):
    me = t.make_user(["update_user"])
    assert t.acting_as(me).patch(f"/api/users/{me.id}/status", json={"is_active": False}).status_code == 422
