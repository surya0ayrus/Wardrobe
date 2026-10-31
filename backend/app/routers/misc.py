"""Permission matrix, dropdown lookups, activity log, dashboard and health check."""
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload

from app import cache, permissions_config as perms, resources
from app.config import settings
from app.db import get_db
from app.deps import authorize, current_company_id, current_user
from app.errors import ValidationFailed, abort
from app.listquery import paginate
from app.models import MORPH_MAP, ActivityLog, Company, Role, User

router = APIRouter(prefix="/api")


# ── Health ───────────────────────────────────────────────────────

@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Quick check that the API can reach the database and the cache (Redis in Docker)."""
    def probe(fn) -> bool:
        try:
            fn()
            return True
        except Exception:
            return False

    checks = {
        "database": probe(lambda: db.execute(text("select 1"))),
        "cache": probe(lambda: cache.store.set("health-check", 1, 10)),
    }
    healthy = all(checks.values())
    from fastapi.responses import JSONResponse
    return JSONResponse({"status": "ok" if healthy else "error", "checks": checks}, status_code=200 if healthy else 503)


# ── Permission matrix (Roles screen), built from permissions_config.py ──

@router.get("/permissions")
def permissions(viewer: User = Depends(current_user)):
    authorize(viewer, "viewAny", "role")

    def resource(key: str) -> dict:
        item = perms.RESOURCES[key]
        return {"key": key, "label": item["label"],
                "permissions": [{"action": a, "name": f"{a}_{key}"} for a in item["actions"]]}

    # Resources grouped as in the menu; anything not listed in a group goes under "Other".
    grouped = [k for keys in perms.GROUPS.values() for k in keys]
    groups = [{"label": label, "resources": [resource(k) for k in keys]} for label, keys in perms.GROUPS.items()]
    other = [k for k in perms.RESOURCES if k not in grouped]
    if other:
        groups.append({"label": "Other", "resources": [resource(k) for k in other]})
    return {"actions": perms.ACTIONS, "groups": groups}


# ── Dropdown lookups: small id + name lists, cached and cleared when the data changes ──

@router.get("/lookups/roles")
def lookup_roles(viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    return cache.remember("lookups:roles", settings.lookup_cache_ttl, lambda: [
        {"id": r.id, "name": r.name} for r in db.scalars(select(Role).order_by(Role.name))])


@router.get("/lookups/companies")
def lookup_companies(viewer: User = Depends(current_user)):
    """Companies the user may give to others (the ones they can reach themselves). Not cached: per user."""
    return [{"id": c.id, "name": c.name, "short_name": c.short_name} for c in viewer.accessible_companies()]


@router.get("/lookups/users")
def lookup_users(request: Request, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    """User search for pickers and the quick search (Ctrl+K), in the current company.
    Not cached (search text changes); returns at most 20 rows."""
    search = (request.query_params.get("search") or "").strip()
    stmt = select(User).where(User.in_company(current_company_id(viewer, db)), User.is_active.is_(True))
    if search:
        term = "%" + re.sub(r"([%_\\])", r"\\\1", search) + "%"
        stmt = stmt.where(User.name.ilike(term, escape="\\") | User.username.ilike(term, escape="\\"))
    return [{"id": u.id, "name": u.name, "username": u.username} for u in db.scalars(stmt.order_by(User.name).limit(20))]


# ── Activity log ─────────────────────────────────────────────────

def _date(value: str | None, field: str) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValidationFailed(f"The {field.replace('_', ' ')} field must be a valid date.", field)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _int(value: str | None) -> int | None:
    return int(value) if value and value.isdigit() and int(value) else None


@router.get("/activity-logs")
def activity_logs(request: Request, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    """Filters: user_id, action, module (+ record_id for one record's history), date_from, date_to.
    Uses "simple" pagination (next / previous only): no count(*) on a table that keeps growing."""
    authorize(viewer, "viewAny", "activity_log")
    q = request.query_params
    date_from, date_to = _date(q.get("date_from"), "date_from"), _date(q.get("date_to"), "date_to")

    stmt = select(ActivityLog).options(selectinload(ActivityLog.user))
    if _int(q.get("user_id")):
        stmt = stmt.where(ActivityLog.user_id == _int(q.get("user_id")))
    if q.get("action"):
        stmt = stmt.where(ActivityLog.action == q.get("action"))
    if q.get("module"):
        stmt = stmt.where(ActivityLog.loggable_type == q.get("module"))
    if _int(q.get("record_id")):
        stmt = stmt.where(ActivityLog.loggable_id == _int(q.get("record_id")))
    if date_from:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.created_at < date_to + timedelta(days=1))

    page = paginate(db, stmt, request, ActivityLog, sortable={"id": ActivityLog.id}, simple=True,
                    default_per_page=25)
    return page.response([resources.activity_log(log) for log in page.items])


def _record_summary(db: Session, log: ActivityLog) -> dict | None:
    """Name of the logged record (also when it was deleted later), or null."""
    cls = MORPH_MAP.get(log.loggable_type or "")
    if not cls or not log.loggable_id:
        return None
    soft = hasattr(cls, "deleted_at")
    record = db.scalars(select(cls).where(cls.id == log.loggable_id).execution_options(include_deleted=True)).first()
    return {
        "exists": record is not None,
        "deleted": bool(soft and record is not None and record.deleted_at is not None),
        # To link to the record's page; only records with a public id have one (users are linked by id).
        "uuid": getattr(record, "uuid", None) if record is not None else None,
        "label": (getattr(record, "name", None) or getattr(record, "username", None)
                  or getattr(record, "short_name", None)) if record is not None else None,
    }


@router.get("/activity-logs/{uuid}")
def activity_log_detail(uuid: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    """Full detail of one log entry, with who did it and which record it is about."""
    import uuid as uuid_lib
    try:
        key = str(uuid_lib.UUID(uuid))
    except ValueError:
        abort(404, "Not found.")
    log = db.scalars(select(ActivityLog).where(ActivityLog.uuid == key)).first()
    if log is None:
        abort(404, "Not found.")
    authorize(viewer, "view", "activity_log")
    return {"data": resources.activity_log(log), "record": _record_summary(db, log)}


# ── Dashboard: one block per module the user may see ──

@router.get("/dashboard")
def dashboard(viewer: User = Depends(current_user), db: Session = Depends(get_db)):
    """The home page's numbers. Each block is added only for people who may see that module;
    add a block here for each new module."""
    company_id = current_company_id(viewer, db)
    data: dict = {}

    if viewer.can("view_user"):
        week_ago = datetime.now(timezone.utc) - timedelta(weeks=1)
        total, active, active_week = db.execute(
            select(
                func.count(),
                func.count().filter(User.is_active.is_(True)),
                func.count().filter(User.last_login_at >= week_ago),
            ).where(User.in_company(company_id))
        ).one()
        data["users"] = {"total": total, "active": active, "inactive": total - active, "active_this_week": active_week}

    if viewer.can("view_activity_log"):
        logs = db.scalars(select(ActivityLog).options(selectinload(ActivityLog.user))
                          .order_by(ActivityLog.id.desc()).limit(8))
        data["recent_activity"] = [resources.activity_log(log) for log in logs]
    return data
