"""Small write helpers shared by the routers."""
from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.activity import utcnow
from app.models import Company, Permission, Role, User, company_user, model_has_roles


def sync_roles(db: Session, user: User, role_ids: list[int]) -> None:
    db.execute(delete(model_has_roles).where(
        model_has_roles.c.model_id == user.id, model_has_roles.c.model_type == "user"))
    if role_ids:
        db.execute(insert(model_has_roles), [
            {"role_id": rid, "model_type": "user", "model_id": user.id} for rid in dict.fromkeys(role_ids)])
    db.expire(user, ["roles"])
    user.__dict__.pop("_perm_cache", None)


def assign_role(db: Session, user: User, role_name: str) -> None:
    role = db.scalars(select(Role).where(Role.name == role_name, Role.guard_name == "web")).one()
    exists = db.scalar(select(func.count()).select_from(model_has_roles).where(
        model_has_roles.c.role_id == role.id, model_has_roles.c.model_id == user.id,
        model_has_roles.c.model_type == "user"))
    if not exists:
        db.execute(insert(model_has_roles).values(role_id=role.id, model_type="user", model_id=user.id))
    db.expire(user, ["roles"])
    user.__dict__.pop("_perm_cache", None)


def sync_permissions(db: Session, role: Role, names: list[str]) -> None:
    role.permissions = list(db.scalars(
        select(Permission).where(Permission.name.in_(set(names)), Permission.guard_name == "web"))) if names else []


def set_companies(db: Session, user: User, company_ids: list[int]) -> None:
    user.companies = list(db.scalars(select(Company).where(Company.id.in_(company_ids)).order_by(Company.id)))


def soft_delete(db: Session, record) -> None:
    record.deleted_at = utcnow()
    db.flush()


def count_company_users(db: Session, company_ids: list[int]) -> dict[int, int]:
    """Users per company (deleted users are not counted)."""
    if not company_ids:
        return {}
    rows = db.execute(
        select(company_user.c.company_id, func.count())
        .join(User, User.id == company_user.c.user_id)
        .where(company_user.c.company_id.in_(company_ids), User.deleted_at.is_(None))
        .group_by(company_user.c.company_id))
    return {cid: n for cid, n in rows}


def count_role_users(db: Session, role_ids: list[int]) -> dict[int, int]:
    if not role_ids:
        return {}
    rows = db.execute(
        select(model_has_roles.c.role_id, func.count())
        .join(User, User.id == model_has_roles.c.model_id)
        .where(model_has_roles.c.role_id.in_(role_ids), model_has_roles.c.model_type == "user",
               User.deleted_at.is_(None))
        .group_by(model_has_roles.c.role_id))
    return {rid: n for rid, n in rows}


def count_role_permissions(db: Session, role_ids: list[int]) -> dict[int, int]:
    from app.models import role_has_permissions

    if not role_ids:
        return {}
    rows = db.execute(
        select(role_has_permissions.c.role_id, func.count())
        .where(role_has_permissions.c.role_id.in_(role_ids)).group_by(role_has_permissions.c.role_id))
    return {rid: n for rid, n in rows}
