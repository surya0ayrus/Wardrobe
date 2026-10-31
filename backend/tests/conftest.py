"""Test setup. Needs a PostgreSQL database named base_app_test (same as the Laravel tests)."""
import os
import secrets
import time

os.environ.update(APP_ENV="testing", DB_DATABASE=os.environ.get("TEST_DB_DATABASE", "base_app_test"),
                  DB_URL="", BCRYPT_ROUNDS="4", CACHE_STORE="array", APP_DEBUG="false")

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import cache  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Company, Role, SessionRecord, User  # noqa: E402
from app.seed import seed_permissions  # noqa: E402
from app.services import assign_role, set_companies, sync_permissions  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    """Build the schema with the real migrations (so they are tested too)."""
    with engine.begin() as conn:
        conn.execute(text("drop schema public cascade"))
        conn.execute(text("create schema public"))
        conn.execute(text("drop collation if exists natural_sort"))
    command.upgrade(Config("alembic.ini"), "head")
    yield


@pytest.fixture(autouse=True)
def clean_db(schema):
    cache.store.flush()
    yield
    with engine.begin() as conn:
        tables = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"truncate {tables} restart identity cascade"))


class Ctx:
    """The Laravel TestCase helpers: makeUser, makeSuperAdmin, actingAs, uuid."""

    def __init__(self, client: TestClient):
        self.client = client
        self.n = 0
        with SessionLocal() as db:
            seed_permissions(db)
            self.main_id = self._company(db, "MAIN", "Main Company")
            self.other_id = self._company(db, "OTHER", "Other Company")
        self.main = self.company(self.main_id)
        self.other = self.company(self.other_id)

    @staticmethod
    def _company(db, short, name) -> int:
        c = Company(short_name=short, name=name)
        db.add(c)
        db.commit()
        return c.id

    def company(self, cid: int) -> Company:
        with SessionLocal() as db:
            return db.get(Company, cid)

    def make_user(self, permissions=(), companies=None, **attrs) -> User:
        self.n += 1
        n = self.n
        companies = companies if companies is not None else [self.main]
        with SessionLocal() as db:
            user = User(
                name=attrs.get("name", f"Person {n}"), username=attrs.get("username", f"person{n}"),
                email=f"person{n}@example.com", password=attrs.get("password", "Secret@123"),
                is_first_login=attrs.get("is_first_login", False), is_active=attrs.get("is_active", True),
                current_company_id=companies[0].id if companies else None,
            )
            db.add(user)
            db.flush()
            set_companies(db, user, [c.id for c in companies])
            if permissions:
                role = Role(name=f"Role {n}", guard_name="web")
                db.add(role)
                db.flush()
                from app.models import Permission
                from sqlalchemy import select
                role.permissions = list(db.scalars(select(Permission).where(Permission.name.in_(permissions))))
                db.flush()
                from app.services import sync_roles
                sync_roles(db, user, [role.id])
            db.commit()
            return db.get(User, user.id)

    def make_super_admin(self) -> User:
        user = self.make_user()
        with SessionLocal() as db:
            assign_role(db, db.get(User, user.id), settings.super_admin_role)
            db.commit()
        return user

    def acting_as(self, user: User) -> TestClient:
        """Log the user in (without the login form) by creating their session."""
        sid = secrets.token_urlsafe(40)
        with SessionLocal() as db:
            import json
            db.add(SessionRecord(id=sid, user_id=user.id, payload=json.dumps({"user_id": user.id, "csrf": "t"}),
                                 last_activity=int(time.time())))
            db.commit()
        self.client.cookies.clear()
        self.client.cookies.set(settings.session_cookie_name, sid)
        return self.client

    def uuid(self, table: str, id: int) -> str:
        with engine.connect() as conn:
            return str(conn.execute(text(f"select uuid from {table} where id = :id"), {"id": id}).scalar())


@pytest.fixture
def t():
    with TestClient(app) as client:
        yield Ctx(client)
