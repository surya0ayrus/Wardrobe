"""Database tables. Table and column names match the Laravel version, so an existing database
keeps working (see README: `alembic stamp head`)."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text, UniqueConstraint,
    and_, exists, func, select, text,
)
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column, object_session, relationship, validates
from sqlalchemy import Uuid

from app.activity import clears_lookup_cache, has_audit_columns, logs_activity, utcnow
from app.config import settings
from app.db import Base, SoftDeletes
from app.security import hash_password, is_hashed

PASSWORD_FIELDS = {"current_password", "password", "password_confirmation"}


def _uuid_col() -> Mapped[str]:
    """Random public id used in URLs instead of the numeric id (HasPublicId)."""
    return mapped_column(Uuid(as_uuid=False), unique=True, default=lambda: str(uuid.uuid4()),
                         server_default=text("gen_random_uuid()"))


def _user_fk() -> Mapped[Optional[int]]:
    return mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


def _created() -> Mapped[Optional[datetime]]:
    return mapped_column(DateTime(timezone=True), default=utcnow, nullable=True)


def _updated() -> Mapped[Optional[datetime]]:
    return mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=True)


# ── Pivot tables ─────────────────────────────────────────────────

company_user = Table(
    "company_user", Base.metadata,
    Column("company_id", BigInteger, ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Index("company_user_user_id_index", "user_id"),
)

role_has_permissions = Table(
    "role_has_permissions", Base.metadata,
    Column("permission_id", BigInteger, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", BigInteger, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)

# Roles of a user: model_type is the short name of the model ("user"), like Spatie's morph map.
model_has_roles = Table(
    "model_has_roles", Base.metadata,
    Column("role_id", BigInteger, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("model_type", String(255), primary_key=True),
    Column("model_id", BigInteger, primary_key=True),
    Index("model_has_roles_model_id_model_type_index", "model_id", "model_type"),
)

# Direct permissions to a user are not used (permissions come from roles); kept for compatibility.
model_has_permissions = Table(
    "model_has_permissions", Base.metadata,
    Column("permission_id", BigInteger, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Column("model_type", String(255), primary_key=True),
    Column("model_id", BigInteger, primary_key=True),
    Index("model_has_permissions_model_id_model_type_index", "model_id", "model_type"),
)


# ── Roles and permissions ────────────────────────────────────────

class Permission(Base):
    __tablename__ = "permissions"
    __morph__ = "permission"
    __table_args__ = (UniqueConstraint("name", "guard_name", name="permissions_name_guard_name_unique"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    guard_name: Mapped[str] = mapped_column(String(255), default="web")
    created_at: Mapped[Optional[datetime]] = _created()
    updated_at: Mapped[Optional[datetime]] = _updated()


@clears_lookup_cache
class Role(Base):
    __tablename__ = "roles"
    __morph__ = "role"
    __table_args__ = (UniqueConstraint("name", "guard_name", name="roles_name_guard_name_unique"),)
    lookup_cache_keys = ("lookups:roles",)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = _uuid_col()
    name: Mapped[str] = mapped_column(String(255))
    guard_name: Mapped[str] = mapped_column(String(255), default="web")
    created_at: Mapped[Optional[datetime]] = _created()
    updated_at: Mapped[Optional[datetime]] = _updated()

    permissions: Mapped[list[Permission]] = relationship(secondary=role_has_permissions, order_by=Permission.name)


# ── Companies ────────────────────────────────────────────────────

@logs_activity
@has_audit_columns
@clears_lookup_cache
class Company(Base, SoftDeletes):
    """A company users work for. Company data is filtered by the user's current company."""

    __tablename__ = "companies"
    __morph__ = "company"
    __table_args__ = (
        Index("companies_short_name_unique", "short_name", unique=True, postgresql_where=text("deleted_at is null")),
        Index("companies_name_trgm", "name", postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"}),
        Index("companies_short_name_trgm", "short_name", postgresql_using="gin",
              postgresql_ops={"short_name": "gin_trgm_ops"}),
    )
    lookup_cache_keys = ("lookups:companies",)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = _uuid_col()
    name: Mapped[str] = mapped_column(String(255))
    short_name: Mapped[str] = mapped_column(String(20))
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    pan: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"), index=True)
    created_by: Mapped[Optional[int]] = _user_fk()
    updated_by: Mapped[Optional[int]] = _user_fk()
    created_at: Mapped[Optional[datetime]] = _created()
    updated_at: Mapped[Optional[datetime]] = _updated()

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])
    updater: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by])
    users: Mapped[list["User"]] = relationship(secondary=company_user, back_populates="companies")


# ── Users ────────────────────────────────────────────────────────

DEFAULT_PREFERENCES = {
    "nav_style": "top",  # top | side
    "theme": "system",   # light | dark | system
}


@logs_activity
@has_audit_columns
class User(Base, SoftDeletes):
    __tablename__ = "users"
    __morph__ = "user"
    __table_args__ = (
        # Unique only among rows that are not deleted, so a deleted login does not block its name.
        Index("users_username_unique", "username", unique=True, postgresql_where=text("deleted_at is null")),
        Index("users_email_unique", "email", unique=True, postgresql_where=text("deleted_at is null")),
        Index("users_name_trgm", "name", postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"}),
        Index("users_username_trgm", "username", postgresql_using="gin", postgresql_ops={"username": "gin_trgm_ops"}),
        Index("users_email_trgm", "email", postgresql_using="gin", postgresql_ops={"email": "gin_trgm_ops"}),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"), index=True)
    is_first_login: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    current_company_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("companies.id", ondelete="SET NULL", use_alter=True,
                               name="users_current_company_id_foreign"), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata", server_default="Asia/Kolkata")
    settings: Mapped[Optional[dict]] = mapped_column(JSONB)  # personal preferences (layout, theme)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    remember_token: Mapped[Optional[str]] = mapped_column(String(100))
    created_by: Mapped[Optional[int]] = _user_fk()
    updated_by: Mapped[Optional[int]] = _user_fk()
    created_at: Mapped[Optional[datetime]] = _created()
    updated_at: Mapped[Optional[datetime]] = _updated()

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by], remote_side=[id])
    updater: Mapped[Optional["User"]] = relationship(foreign_keys=[updated_by], remote_side=[id])
    companies: Mapped[list[Company]] = relationship(secondary=company_user, back_populates="users",
                                                    order_by=Company.id)
    # Read-only: changed with app.services.sync_roles() / assign_role().
    roles: Mapped[list[Role]] = relationship(
        secondary=model_has_roles,
        primaryjoin=lambda: and_(User.id == model_has_roles.c.model_id, model_has_roles.c.model_type == "user"),
        secondaryjoin=lambda: Role.id == model_has_roles.c.role_id,
        viewonly=True, order_by=Role.name,
    )

    hidden_from_log = ()  # password is masked by the logger itself

    # Stored lower-case so login is not case-sensitive.
    @validates("username")
    def _username(self, key, value):
        return value.strip().lower() if value else value

    @validates("email")
    def _email(self, key, value):
        return value.strip().lower() if value else None

    @validates("password")
    def _password(self, key, value):
        return value if is_hashed(value) else hash_password(value)

    def preferences(self) -> dict:
        saved = self.settings or {}
        return {**DEFAULT_PREFERENCES, **{k: v for k, v in saved.items() if k in DEFAULT_PREFERENCES}}

    # ── Roles & permissions ──────────────────────────────────────

    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]

    def is_super_admin(self) -> bool:
        return settings.super_admin_role in self.role_names()

    def is_admin(self) -> bool:
        return settings.admin_role in self.role_names()

    def permission_names(self) -> list[str]:
        """Permissions given through the user's roles (worked out once per request)."""
        cached = self.__dict__.get("_perm_cache")
        if cached is None:
            db = object_session(self)
            cached = sorted(set(db.scalars(
                select(Permission.name)
                .join(role_has_permissions, role_has_permissions.c.permission_id == Permission.id)
                .join(model_has_roles, model_has_roles.c.role_id == role_has_permissions.c.role_id)
                .where(model_has_roles.c.model_id == self.id, model_has_roles.c.model_type == "user")
            )))
            self.__dict__["_perm_cache"] = cached
        return cached

    def can(self, permission: str) -> bool:
        """SuperAdmin passes every permission check."""
        return self.is_super_admin() or permission in self.permission_names()

    # ── Companies ────────────────────────────────────────────────

    def accessible_companies_stmt(self):
        """Companies this user can switch to: all active ones for SuperAdmin, otherwise their own."""
        stmt = select(Company).where(Company.is_active.is_(True)).order_by(Company.id)
        if not self.is_super_admin():
            stmt = stmt.where(Company.id.in_(
                select(company_user.c.company_id).where(company_user.c.user_id == self.id)))
        return stmt

    def accessible_companies(self) -> list[Company]:
        return list(object_session(self).scalars(self.accessible_companies_stmt()))

    def accessible_company_ids(self) -> list[int]:
        """Ids of accessible_companies(), worked out once per request."""
        cached = self.__dict__.get("_company_ids")
        if cached is None:
            cached = [c.id for c in self.accessible_companies()]
            self.__dict__["_company_ids"] = cached
        return cached

    def can_access_company(self, company_id: int) -> bool:
        return company_id in self.accessible_company_ids()

    @staticmethod
    def in_company(company_id: int):
        """Filter: members of the given company."""
        return exists().where(company_user.c.user_id == User.id, company_user.c.company_id == company_id)


# ── Activity log and sessions ────────────────────────────────────

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (
        Index("activity_logs_loggable_type_loggable_id_id_index", "loggable_type", "loggable_id", "id"),
        Index("activity_logs_user_id_id_index", "user_id", "id"),
        Index("activity_logs_action_id_index", "action", "id"),
        Index("activity_logs_created_at_index", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = _uuid_col()
    user_id: Mapped[Optional[int]] = _user_fk()
    action: Mapped[str] = mapped_column(String(50))
    loggable_type: Mapped[Optional[str]] = mapped_column(String(50))
    loggable_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    old_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_values: Mapped[Optional[dict]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(Text)
    method: Mapped[Optional[str]] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now())

    user: Mapped[Optional[User]] = relationship()


class SessionRecord(Base):
    """Server-side login sessions (the browser only holds the random id in a cookie)."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    payload: Mapped[str] = mapped_column(Text)
    last_activity: Mapped[int] = mapped_column(Integer, index=True)


# Short names stored in *_type columns (activity_logs): morph map.
MORPH_MAP = {"user": User, "company": Company, "role": Role, "permission": Permission}
