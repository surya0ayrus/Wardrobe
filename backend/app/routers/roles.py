"""Roles are created in the UI; permissions are ticked in the permission matrix.
The SuperAdmin role is fixed: it cannot be edited or deleted. The default role (User)
keeps its name and cannot be deleted; its permissions can change."""
import uuid as uuid_lib

from fastapi import APIRouter, Body, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import activity, cache, resources, services
from app.config import settings
from app.db import get_db
from app.deps import authorize, current_user
from app.errors import ValidationFailed, abort, abort_if
from app.models import Permission, Role, User, model_has_roles
from app.schemas import RoleIn, parse
from sqlalchemy import func

router = APIRouter(prefix="/api/roles")


def find(db: Session, id: str) -> Role:
    try:
        key = str(uuid_lib.UUID(id))
    except ValueError:
        abort(404, "Not found.")
    role = db.scalars(select(Role).where(Role.uuid == key)).first()
    abort_if(role is None, 404, "Not found.")
    return role


def validated(db: Session, payload: dict, role: Role | None = None) -> dict:
    data = parse(RoleIn, payload).model_dump()
    data["permissions"] = data["permissions"] or []
    errors: dict[str, list[str]] = {}

    taken = select(Role.id).where(Role.name == data["name"], Role.guard_name == "web")
    if role:
        taken = taken.where(Role.id != role.id)
    if db.scalars(taken).first():
        errors["name"] = ["The name has already been taken."]

    known = set(db.scalars(select(Permission.name).where(Permission.guard_name == "web")))
    for i, name in enumerate(data["permissions"]):
        if name not in known:
            errors[f"permissions.{i}"] = [f"The selected permissions.{i} is invalid."]
    if errors:
        raise ValidationFailed(errors)
    return data


def ensure_editable(role: Role, viewer: User) -> None:
    abort_if(role.name == settings.super_admin_role, 422, "The SuperAdmin role cannot be changed.")
    # Admins cannot widen or remove their own role: only the SuperAdmin changes it.
    abort_if(role.name == settings.admin_role and not viewer.is_super_admin(), 403,
             "Only the SuperAdmin can change the Admin role.")


def one(db: Session, role: Role) -> dict:
    db.refresh(role, ["permissions"])
    users = services.count_role_users(db, [role.id]).get(role.id, 0)
    return {"data": resources.role(role, users, len(role.permissions), with_permissions=True)}


def done(db: Session, role: Role) -> dict:
    cache.forget("lookups:roles")
    return one(db, role)


@router.get("")
def index(request: Request, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize(viewer, "viewAny", "role")
    stmt = select(Role).order_by(Role.id.desc())  # newest first, like every list
    search = (request.query_params.get("search") or "").strip()
    if search:
        import re
        term = "%" + re.sub(r"([%_\\])", r"\\\1", search) + "%"
        stmt = stmt.where(Role.name.ilike(term, escape="\\"))
    roles = list(db.scalars(stmt))
    ids = [r.id for r in roles]
    users, perms = services.count_role_users(db, ids), services.count_role_permissions(db, ids)
    return {"data": [resources.role(r, users.get(r.id, 0), perms.get(r.id, 0)) for r in roles]}


@router.post("", status_code=201)
def store(payload: dict = Body(default_factory=dict), viewer: User = Depends(current_user),
          db: Session = Depends(get_db)):
    authorize(viewer, "create", "role")
    data = validated(db, payload)

    role = Role(name=data["name"], guard_name="web")
    db.add(role)
    db.flush()
    services.sync_permissions(db, role, data["permissions"])
    activity.log(db, "created", role, None, data)
    db.commit()
    return done(db, role)


@router.get("/{id}")
def show(id: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    role = find(db, id)
    authorize(viewer, "view", "role")
    return one(db, role)


@router.put("/{id}")
def update(id: str, payload: dict = Body(default_factory=dict), viewer: User = Depends(current_user),
           db: Session = Depends(get_db)):
    role = find(db, id)
    authorize(viewer, "update", "role")
    ensure_editable(role, viewer)
    data = validated(db, payload, role)
    abort_if(role.name == settings.app_default_role and data["name"] != role.name, 422,
             "The default role cannot be renamed.")

    old = {"name": role.name, "permissions": sorted(p.name for p in role.permissions)}
    role.name = data["name"]
    services.sync_permissions(db, role, data["permissions"])
    new = {"name": data["name"], "permissions": sorted(data["permissions"])}
    if old != new:
        activity.log(db, "updated", role, old, new)
    db.commit()
    return done(db, role)


@router.delete("/{id}", status_code=204)
def destroy(id: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    role = find(db, id)
    authorize(viewer, "delete", "role")
    ensure_editable(role, viewer)
    abort_if(role.name == settings.app_default_role, 422, "The default role cannot be deleted.")
    abort_if(services.count_role_users(db, [role.id]).get(role.id), 422,
             "This role is assigned to users. Remove it from them first.")

    activity.log(db, "deleted", role, {"name": role.name})
    db.delete(role)
    db.commit()
    cache.forget("lookups:roles")
    return Response(status_code=204)
