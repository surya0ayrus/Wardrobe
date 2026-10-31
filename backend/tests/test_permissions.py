from sqlalchemy import func, select

from app import permissions_config
from app.db import SessionLocal
from app.models import Permission, Role


def role_id(name):
    with SessionLocal() as db:
        return db.scalar(select(Role.id).where(Role.name == name))


def test_permission_is_required_and_granted_per_action(t):
    c = t.acting_as(t.make_user(["view_role"]))
    assert c.get("/api/roles").status_code == 200
    assert c.post("/api/roles", json={"name": "Supervisor"}).status_code == 403
    assert c.get("/api/users").status_code == 403


def test_super_admin_passes_every_check(t):
    r = t.acting_as(t.make_super_admin()).post("/api/roles", json={"name": "Supervisor"})
    assert r.status_code == 201 and r.json()["data"]["name"] == "Supervisor"


def test_roles_are_managed_from_the_ui_but_super_admin_role_is_fixed(t):
    c = t.acting_as(t.make_user(["view_role", "create_role", "update_role", "delete_role"]))

    r = c.post("/api/roles", json={"name": "HR Admin", "permissions": ["view_company", "view_user"]})
    assert r.status_code == 201 and r.json()["data"]["permissions_count"] == 2
    uuid = t.uuid("roles", r.json()["data"]["id"])

    r = c.put(f"/api/roles/{uuid}", json={"name": "HR Manager", "permissions": ["view_user"]})
    assert r.status_code == 200 and r.json()["data"]["name"] == "HR Manager"
    assert c.put(f"/api/roles/{uuid}", json={"name": "X", "permissions": ["nope"]}).status_code == 422

    sup = t.uuid("roles", role_id("SuperAdmin"))
    assert c.put(f"/api/roles/{sup}", json={"name": "Hacked"}).status_code == 422
    assert c.delete(f"/api/roles/{sup}").status_code == 422

    body = c.get("/api/permissions").json()
    assert "special" not in body
    assert body["groups"][1]["label"] == "User management"
    assert body["groups"][1]["resources"][0]["key"] == "user"
    assert [g["label"] for g in body["groups"]] == list(permissions_config.GROUPS)
    keys = [res["key"] for g in body["groups"] for res in g["resources"]]
    assert sorted(keys) == sorted(permissions_config.RESOURCES)


def test_only_the_super_admin_changes_the_admin_role(t):
    with SessionLocal() as db:
        admin = db.scalars(select(Role).where(Role.name == "Admin")).one()
        assert len(admin.permissions) == db.scalar(select(func.count()).select_from(Permission))
        uuid = admin.uuid
    r = t.acting_as(t.make_user(["update_role"])).put(f"/api/roles/{uuid}", json={"name": "Admin", "permissions": []})
    assert r.status_code == 403


def test_the_default_user_role_keeps_its_name_but_its_permissions_can_change(t):
    c = t.acting_as(t.make_user(["view_role", "update_role", "delete_role"]))
    uuid = t.uuid("roles", role_id("User"))

    assert c.put(f"/api/roles/{uuid}", json={"name": "Normal", "permissions": []}).status_code == 422
    r = c.put(f"/api/roles/{uuid}", json={"name": "User", "permissions": ["view_company", "view_user"]})
    assert r.status_code == 200 and r.json()["data"]["permissions_count"] == 2
    assert c.delete(f"/api/roles/{uuid}").status_code == 422


def test_roles_list_shows_counts(t):
    r = t.acting_as(t.make_user(["view_role"])).get("/api/roles")
    assert r.status_code == 200
    assert {"id", "name", "users_count", "permissions_count"} <= set(r.json()["data"][0])
