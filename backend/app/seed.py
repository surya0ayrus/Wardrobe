"""Seeders. Run:  python -m app.seed           (everything: permissions, company, SuperAdmin)
                  python -m app.seed permissions  (only sync permissions: safe on every deploy)"""
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import cache, permissions_config
from app.config import settings
from app.db import SessionLocal
from app.models import Company, Permission, Role, User
from app.services import assign_role, sync_permissions


def seed_permissions(db: Session) -> None:
    """Makes the permissions table match permissions_config.py (adds new ones, deletes ones no
    longer listed, which also takes them off every role) and creates the fixed roles."""
    names = permissions_config.all_permission_names()
    existing = set(db.scalars(select(Permission.name).where(Permission.guard_name == "web")))
    db.add_all(Permission(name=n, guard_name="web") for n in names if n not in existing)
    for stale in db.scalars(select(Permission).where(Permission.guard_name == "web", Permission.name.not_in(names))):
        db.delete(stale)
    db.flush()

    def role(name: str) -> tuple[Role, bool]:
        found = db.scalars(select(Role).where(Role.name == name, Role.guard_name == "web")).first()
        if found:
            return found, False
        found = Role(name=name, guard_name="web")
        db.add(found)
        db.flush()
        return found, True

    role(settings.super_admin_role)  # needs no permissions assigned: it passes every check
    role(settings.app_default_role)  # the everyday role; starts without permissions
    admin, created = role(settings.admin_role)  # starts with every permission; then only SuperAdmin changes it
    if created:
        sync_permissions(db, admin, names)
    db.commit()
    cache.forget("lookups:roles")


def seed_company(db: Session) -> None:
    """The first company; more are added on the Companies page."""
    if db.scalars(select(Company.id)).first() is None:
        db.add(Company(short_name=settings.default_company_short_name, name=settings.default_company_name))
        db.commit()


def seed_super_admin(db: Session) -> None:
    """The first login. It belongs to no company (SuperAdmins reach all of them) and must change
    its password at first login."""
    user = db.scalars(select(User).where(User.username == settings.superadmin_username)).first()
    if user is None:
        user = User(name="Super Admin", username=settings.superadmin_username, email=settings.superadmin_email,
                    password=settings.superadmin_password, is_first_login=True)
        db.add(user)
        db.flush()
    assign_role(db, user, settings.super_admin_role)
    db.commit()


def main(what: str = "all") -> None:
    with SessionLocal() as db:
        seed_permissions(db)
        if what == "all":
            seed_company(db)
            seed_super_admin(db)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "all")
