from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import ActivityLog

CRUD = ["view_company", "create_company", "update_company", "delete_company"]


def test_full_crud_with_permissions(t):
    c = t.acting_as(t.make_user(CRUD))

    r = c.post("/api/companies", json={"name": "New Co", "short_name": " newco "})
    assert r.status_code == 201
    assert r.json()["data"]["short_name"] == "NEWCO" and r.json()["data"]["is_active"] is True
    uuid = r.json()["data"]["uuid"]

    r = c.post("/api/companies", json={"name": "Copy", "short_name": "NEWCO"})
    assert r.status_code == 422 and "short_name" in r.json()["errors"]

    r = c.put(f"/api/companies/{uuid}", json={"name": "New Company", "short_name": "NEWCO", "city": "Chennai"})
    assert r.status_code == 200 and r.json()["data"]["city"] == "Chennai"
    r = c.patch(f"/api/companies/{uuid}/status", json={"is_active": False})
    assert r.status_code == 200 and r.json()["data"]["is_active"] is False

    assert len(c.get("/api/companies?search=new").json()["data"]) == 1
    assert len(c.get("/api/companies?status=inactive").json()["data"]) == 1

    assert c.delete(f"/api/companies/{uuid}").status_code == 204
    assert c.get(f"/api/companies/{uuid}").status_code == 404
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(ActivityLog)
                         .filter_by(action="deleted", loggable_type="company")) == 1
    assert len(c.get("/api/companies").json()["data"]) == 2  # the deleted one is hidden, MAIN + OTHER remain


def test_list_has_laravel_pagination_shape(t):
    c = t.acting_as(t.make_user(["view_company"]))
    body = c.get("/api/companies?per_page=1&sort=short_name").json()
    assert body["meta"]["total"] == 2 and body["meta"]["last_page"] == 2 and body["meta"]["per_page"] == 1
    assert body["data"][0]["short_name"] == "MAIN" and body["data"][0]["users_count"] == 1
    assert body["links"]["next"] and body["links"]["prev"] is None


def test_a_company_with_users_cannot_be_deleted(t):
    c = t.acting_as(t.make_user(["delete_company"]))
    t.make_user()
    assert c.delete(f"/api/companies/{t.main.uuid}").status_code == 422


def test_view_only_cannot_change(t):
    c = t.acting_as(t.make_user(["view_company"]))
    assert c.get("/api/companies").status_code == 200
    assert c.post("/api/companies", json={"name": "X", "short_name": "X"}).status_code == 403
    assert c.patch(f"/api/companies/{t.main.uuid}/status", json={"is_active": False}).status_code == 403
