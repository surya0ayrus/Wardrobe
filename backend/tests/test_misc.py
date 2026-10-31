from sqlalchemy import func, select

from app import cache
from app.db import SessionLocal, engine
from app.models import ActivityLog, Role, User
from sqlalchemy import event


def test_lookup_is_cached_and_cleared_when_data_changes(t):
    c = t.acting_as(t.make_user())
    with SessionLocal() as db:
        count = db.scalar(select(func.count()).select_from(Role))

    assert len(c.get("/api/lookups/roles").json()) == count
    assert cache.has("lookups:roles")

    queries = []
    listener = lambda conn, cur, stmt, *a: queries.append(stmt)
    event.listen(engine, "before_cursor_execute", listener)
    c.get("/api/lookups/roles")
    event.remove(engine, "before_cursor_execute", listener)
    assert not [q for q in queries if 'FROM roles' in q]

    with SessionLocal() as db:
        db.add(Role(name="Supervisor", guard_name="web"))
        db.commit()
    assert not cache.has("lookups:roles")
    assert len(c.get("/api/lookups/roles").json()) == count + 1


def test_user_lookup_is_per_company(t):
    viewer = t.make_user(name="Ravi Kumar")
    t.make_user(companies=[t.other], name="Ravi Shankar")
    r = t.acting_as(viewer).get("/api/lookups/users?search=ravi").json()
    assert len(r) == 1 and r[0]["name"] == "Ravi Kumar"


def test_company_lookup_lists_only_reachable_companies(t):
    r = t.acting_as(t.make_user()).get("/api/lookups/companies").json()
    assert len(r) == 1 and r[0]["short_name"] == "MAIN"
    assert len(t.acting_as(t.make_super_admin()).get("/api/lookups/companies").json()) == 2


def test_dashboard_user_counts_follow_company_and_permissions(t):
    viewer = t.make_user(["view_user"])
    t.make_user(is_active=False)
    t.make_user(companies=[t.other])  # other company: not counted
    body = t.acting_as(viewer).get("/api/dashboard").json()
    assert body["users"]["total"] == 2 and body["users"]["active"] == 1 and body["users"]["inactive"] == 1
    assert "recent_activity" not in body


def test_dashboard_blocks_need_their_permission(t):
    body = t.acting_as(t.make_user(["view_activity_log"])).get("/api/dashboard").json()
    assert "users" not in body and "recent_activity" in body


def test_a_missing_current_company_falls_back_to_the_first_accessible_one(t):
    admin = t.make_super_admin()
    with SessionLocal() as db:
        db.get(User, admin.id).current_company_id = None
        db.commit()
    assert t.acting_as(admin).get("/api/users").status_code == 200
    with SessionLocal() as db:
        assert db.get(User, admin.id).current_company_id == t.main_id


def test_a_company_the_user_lost_access_to_is_replaced(t):
    user = t.make_user(["view_user"], companies=[t.main, t.other])
    with SessionLocal() as db:
        u = db.get(User, user.id)
        u.current_company_id = t.other_id
        u.companies = [c for c in u.companies if c.id != t.other_id]
        db.commit()
    assert t.acting_as(user).get("/api/users").status_code == 200
    with SessionLocal() as db:
        assert db.get(User, user.id).current_company_id == t.main_id


def test_companies_are_addressed_by_uuid_not_id(t):
    c = t.acting_as(t.make_super_admin())
    r = c.get(f"/api/companies/{t.main.uuid}")
    assert r.status_code == 200 and r.json()["data"]["short_name"] == "MAIN"
    assert c.get(f"/api/companies/{t.main.id}").status_code == 404


def test_log_detail_links_records_with_a_public_id(t):
    login = t.make_user()
    c = t.acting_as(t.make_super_admin())
    assert c.post("/api/roles", json={"name": "Supervisor"}).status_code == 201
    assert c.patch(f"/api/users/{login.id}/status", json={"is_active": False}).status_code == 200

    with SessionLocal() as db:
        user_log = db.scalars(select(ActivityLog).where(ActivityLog.loggable_type == "user")
                              .order_by(ActivityLog.id.desc())).first().uuid
        role_log = db.scalars(select(ActivityLog).where(ActivityLog.loggable_type == "role")
                              .order_by(ActivityLog.id.desc())).first().uuid

    assert c.get(f"/api/activity-logs/{user_log}").json()["record"]["uuid"] is None  # a login has no uuid
    assert isinstance(c.get(f"/api/activity-logs/{role_log}").json()["record"]["uuid"], str)

    listing = c.get("/api/activity-logs?module=role").json()
    assert listing["meta"]["per_page"] == 25 and listing["data"][0]["module"] == "role"


def test_health(t):
    r = t.client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
