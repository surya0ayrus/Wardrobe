"""Logins. New users get the default password (changed at first login), one or more roles and the
companies they may switch to. Users are addressed by id (they have no public uuid)."""
from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session, selectinload

from app import activity, resources, services
from app.activity import save_quietly
from app.config import settings
from app.db import get_db
from app.deps import authorize, current_company_id, current_user
from app.errors import ValidationFailed, abort, abort_if
from app.listquery import paginate
from app.models import Company, Role, User, company_user, model_has_roles
from app.schemas import StatusIn, UserIn, parse

router = APIRouter(prefix="/api/users")


def visible_stmt(db: Session, viewer: User):
    """Users of the current company; SuperAdmins also see logins without a company (e.g. themselves)."""
    cond = User.in_company(current_company_id(viewer, db))
    if viewer.is_super_admin():
        cond = cond | ~exists().where(company_user.c.user_id == User.id)
    return select(User).where(cond)


def find(db: Session, viewer: User, id: str) -> User:
    abort_if(not id.isdigit(), 404, "Not found.")
    user = db.scalars(visible_stmt(db, viewer).where(User.id == int(id))).first()
    abort_if(user is None, 404, "Not found.")
    return user


def validated(db: Session, payload: dict, user: User | None = None) -> dict:
    data = parse(UserIn, payload).model_dump()
    errors: dict[str, list[str]] = {}

    data["company_ids"] = list(dict.fromkeys(data["company_ids"]))
    username, email = data["username"].strip().lower(), data["email"]

    taken = select(User.id).where(User.username == username)
    if user:
        taken = taken.where(User.id != user.id)
    if db.scalars(taken).first():
        errors["username"] = ["The username has already been taken."]
    if email:
        taken = select(User.id).where(User.email == email.lower())
        if user:
            taken = taken.where(User.id != user.id)
        if db.scalars(taken).first():
            errors["email"] = ["The email has already been taken."]

    found_roles = set(db.scalars(select(Role.id).where(Role.id.in_(data["role_ids"]))))
    for i, rid in enumerate(data["role_ids"]):
        if rid not in found_roles:
            errors.setdefault(f"role_ids.{i}", []).append("The selected role_ids.%d is invalid." % i)
    found_companies = set(db.scalars(select(Company.id).where(Company.id.in_(data["company_ids"]))))
    for i, cid in enumerate(data["company_ids"]):
        if cid not in found_companies:
            errors.setdefault(f"company_ids.{i}", []).append("The selected company_ids.%d is invalid." % i)

    if errors:
        raise ValidationFailed(errors)
    return data


def guard_roles(db: Session, viewer: User, role_ids: list[int]) -> None:
    if viewer.is_super_admin():
        return
    # SuperAdmin and Admin have every permission: only the SuperAdmin may give them out.
    fixed = set(db.scalars(select(Role.id).where(Role.name.in_([settings.super_admin_role, settings.admin_role]))))
    abort_if(fixed & set(role_ids), 403, "Only a SuperAdmin can assign the SuperAdmin or Admin role.")


def guard_companies(db: Session, viewer: User, company_ids: list[int], user: User | None = None) -> list[int]:
    """Only companies the editor can reach may be given. Companies of the user the editor cannot
    reach are kept as they are (an admin of one company does not remove someone from another)."""
    reachable = viewer.accessible_company_ids()
    if set(company_ids) - set(reachable):
        raise ValidationFailed("You can only add users to companies you have access to.", "company_ids")
    if user:
        hidden = [c.id for c in user.companies if c.id not in reachable]
        company_ids = list(dict.fromkeys([*company_ids, *hidden]))
    return company_ids


def guard_super_admin(viewer: User, user: User) -> None:
    abort_if(user.is_super_admin() and not viewer.is_super_admin(), 403,
             "Only a SuperAdmin can change a SuperAdmin login.")


def snapshot(user: User) -> dict:
    return {"roles": sorted(r.name for r in user.roles), "companies": sorted(c.short_name for c in user.companies)}


def one(db: Session, user: User) -> dict:
    db.refresh(user, ["roles", "companies", "creator", "updater"])
    return {"data": resources.user(user, detailed=True)}


@router.get("")
def index(request: Request, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize(viewer, "viewAny", "user")
    stmt = visible_stmt(db, viewer).options(selectinload(User.roles), selectinload(User.companies))
    role_id = request.query_params.get("role_id")
    if role_id and role_id.isdigit() and int(role_id):
        stmt = stmt.where(exists().where(model_has_roles.c.model_id == User.id,
                                         model_has_roles.c.model_type == "user",
                                         model_has_roles.c.role_id == int(role_id)))
    page = paginate(
        db, stmt, request, User,
        searchable=[User.name, User.username, User.email, User.phone],
        sortable={"id": User.id, "name": User.name, "username": User.username,
                  "last_login_at": User.last_login_at, "created_at": User.created_at},
    )
    return page.response([resources.user(u) for u in page.items])


@router.post("", status_code=201)
def store(payload: dict = Body(default_factory=dict), viewer: User = Depends(current_user),
          db: Session = Depends(get_db)):
    authorize(viewer, "create", "user")
    data = validated(db, payload)
    guard_roles(db, viewer, data["role_ids"])
    company_ids = guard_companies(db, viewer, data["company_ids"])

    user = User(
        name=data["name"], username=data["username"], email=data["email"], phone=data["phone"],
        password=settings.app_default_password, is_first_login=True, current_company_id=company_ids[0],
    )
    db.add(user)
    db.flush()
    services.sync_roles(db, user, data["role_ids"])
    services.set_companies(db, user, company_ids)
    db.commit()
    return one(db, user)


@router.get("/{id}")
def show(id: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    user = find(db, viewer, id)
    authorize(viewer, "view", "user")
    return one(db, user)


@router.put("/{id}")
def update(id: str, payload: dict = Body(default_factory=dict), viewer: User = Depends(current_user),
           db: Session = Depends(get_db)):
    user = find(db, viewer, id)
    authorize(viewer, "update", "user")
    guard_super_admin(viewer, user)

    data = validated(db, payload, user)
    guard_roles(db, viewer, data["role_ids"])
    company_ids = guard_companies(db, viewer, data["company_ids"], user)

    old = snapshot(user)
    for key in ("name", "username", "email", "phone"):
        setattr(user, key, data[key])
    services.sync_roles(db, user, data["role_ids"])
    services.set_companies(db, user, company_ids)
    db.flush()
    db.refresh(user, ["roles", "companies"])

    new = snapshot(user)
    if old != new:
        activity.log(db, "roles_updated", user, old, new)
    db.commit()
    return one(db, user)


@router.post("/{id}/reset-password")
def reset_password(id: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    """Back to the default password; the user must change it at the next login."""
    user = find(db, viewer, id)
    authorize(viewer, "update", "user")
    guard_super_admin(viewer, user)

    user.password = settings.app_default_password
    user.is_first_login = True
    save_quietly(db, user)
    activity.log(db, "password_reset", user)
    db.commit()
    return {"message": "Password reset to the default password."}


@router.patch("/{id}/status")
def status(id: str, payload: dict = Body(default_factory=dict), viewer: User = Depends(current_user),
           db: Session = Depends(get_db)):
    data = parse(StatusIn, payload)
    user = find(db, viewer, id)
    authorize(viewer, "update", "user")
    guard_super_admin(viewer, user)
    abort_if(not data.is_active and user.id == viewer.id, 422, "You cannot deactivate your own account.")

    user.is_active = data.is_active
    db.commit()
    return {"data": {"id": user.id, "is_active": user.is_active}}
