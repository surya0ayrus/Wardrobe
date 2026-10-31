"""Activity log: writes rows to activity_logs, and the model hooks that do it automatically
(the Python version of LogsActivity, HasAuditColumns and ClearsLookupCache)."""
import ipaddress
import json
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, object_session

from app import cache

HIDDEN = {"password", "password_confirmation", "remember_token", "current_password", "token"}
MAX_STRING = 2000
# Fields never listed as "changed" on update.
IGNORED_ON_UPDATE = {"updated_at", "updated_by", "created_at", "deleted_at", "remember_token", "last_login_at"}

_enabled: ContextVar[bool] = ContextVar("activity_enabled", default=True)
_quiet: ContextVar[bool] = ContextVar("activity_quiet", default=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@contextmanager
def without_logging():
    """Run code without writing a log row per record, e.g. during a big import
    (the import writes one summary row instead)."""
    token = _enabled.set(False)
    try:
        yield
    finally:
        _enabled.reset(token)


@contextmanager
def quietly():
    """Like Laravel's saveQuietly(): saves made inside do not write the automatic log row."""
    token = _quiet.set(True)
    try:
        yield
    finally:
        _quiet.reset(token)


def save_quietly(db: Session, *objs) -> None:
    with quietly():
        db.add_all(objs)
        db.flush()


def _json_default(value: Any):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def clean(values: Any) -> Any:
    """Masks secrets, shortens very long strings, and makes everything JSON-safe."""
    if values is None:
        return None
    if isinstance(values, dict):
        out = {}
        for key, value in values.items():
            if key in HIDDEN:
                out[key] = "***"
            else:
                out[key] = clean(value)
        return out
    if isinstance(values, (list, tuple, set)):
        return [clean(v) for v in values]
    if isinstance(values, str) and len(values) > MAX_STRING:
        return values[:MAX_STRING] + "…"
    return json.loads(json.dumps(values, default=_json_default))


def _valid_ip(value):
    try:
        return str(ipaddress.ip_address(value)) if value else None
    except ValueError:
        return None  # e.g. a unix socket or test client


def write_log(conn, info: dict, action: str, model_type: str | None, model_id: int | None,
              old: dict | None = None, new: dict | None = None) -> None:
    from app.models import ActivityLog

    conn.execute(ActivityLog.__table__.insert().values(
        uuid=__import__("uuid").uuid4().__str__(),
        user_id=info.get("user_id"),
        action=action,
        loggable_type=model_type,
        loggable_id=model_id,
        old_values=clean(old),
        new_values=clean(new),
        ip_address=_valid_ip(info.get("ip")),
        user_agent=info.get("user_agent"),
        url=info.get("url"),
        method=info.get("method"),
        created_at=utcnow(),
    ))


def log(db: Session, action: str, model=None, old: dict | None = None, new: dict | None = None) -> None:
    """ActivityLogger::log(): one row for an action, e.g. login, password_reset."""
    if not _enabled.get():
        return
    db.flush()
    write_log(
        db.connection(), db.info, action,
        getattr(model, "__morph__", None) if model is not None else None,
        model.id if model is not None else None,
        old, new,
    )


# ── Model hooks ──────────────────────────────────────────────────

def _attributes_for_log(target) -> dict:
    state = inspect(target)
    skip = {"created_at", "updated_at", "deleted_at"}
    out = {}
    for attr in state.mapper.column_attrs:
        value = state.dict.get(attr.key)
        if attr.key not in skip and value is not None:
            out[attr.key] = value
    return out


def _hide(target, values: dict | None) -> dict | None:
    if values is None:
        return None
    for field in getattr(target, "hidden_from_log", ()):
        if field in values:
            values[field] = "[hidden]"
    return values


def _info(target) -> dict:
    session = object_session(target)
    return session.info if session is not None else {}


def _active() -> bool:
    return _enabled.get() and not _quiet.get()


def logs_activity(cls):
    """Class decorator: writes an activity_logs row on create / update / delete / restore.
    Updates store only the fields that changed (old -> new)."""

    @event.listens_for(cls, "after_insert")
    def _created(mapper, connection, target):
        if _active():
            write_log(connection, _info(target), "created", target.__morph__, target.id,
                      None, _hide(target, _attributes_for_log(target)))

    @event.listens_for(cls, "after_update")
    def _updated(mapper, connection, target):
        if not _active():
            return
        state = inspect(target)
        changes = {}
        for attr in mapper.column_attrs:
            hist = state.attrs[attr.key].history
            if hist.has_changes():
                changes[attr.key] = (hist.deleted[0] if hist.deleted else None, hist.added[0] if hist.added else None)

        info = _info(target)
        if "deleted_at" in changes:
            before, after = changes["deleted_at"]
            if before is None and after is not None:
                write_log(connection, info, "deleted", target.__morph__, target.id,
                          _hide(target, _attributes_for_log(target)))
                return
            if before is not None and after is None:
                write_log(connection, info, "restored", target.__morph__, target.id)
                return

        new = {k: v[1] for k, v in changes.items() if k not in IGNORED_ON_UPDATE}
        if new:
            old = {k: changes[k][0] for k in new}
            write_log(connection, info, "updated", target.__morph__, target.id, _hide(target, old), _hide(target, new))

    return cls


def has_audit_columns(cls):
    """Class decorator: fills created_by / updated_by with the logged-in user automatically."""

    @event.listens_for(cls, "before_insert")
    def _creating(mapper, connection, target):
        user_id = _info(target).get("user_id")
        if target.created_by is None:
            target.created_by = user_id
        if target.updated_by is None:
            target.updated_by = user_id

    @event.listens_for(cls, "before_update")
    def _updating(mapper, connection, target):
        user_id = _info(target).get("user_id")
        if user_id:
            target.updated_by = user_id

    return cls


def clears_lookup_cache(cls):
    """Class decorator: forgets the cached dropdown lists (cls.lookup_cache_keys) once the change is committed."""

    def mark(mapper, connection, target):
        session = object_session(target)
        if session is not None:
            session.info.setdefault("clear_keys", set()).update(target.lookup_cache_keys)

    for name in ("after_insert", "after_update", "after_delete"):
        event.listen(cls, name, mark)
    return cls


@event.listens_for(Session, "after_commit")
def _clear_keys_after_commit(session):
    for key in session.info.pop("clear_keys", ()):
        cache.forget(key)


@event.listens_for(Session, "after_soft_rollback")
def _drop_keys_after_rollback(session, previous_transaction):
    session.info.pop("clear_keys", None)
