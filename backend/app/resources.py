"""JSON shapes the React app receives (the Laravel API Resources)."""
from datetime import datetime, timezone

from app.config import settings


def iso(value: datetime | None) -> str | None:
    """Laravel's date format: 2026-10-30T09:56:43.000000Z (UTC)."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def _only(obj, *fields) -> dict | None:
    return None if obj is None else {f: getattr(obj, f) for f in fields}


def audit_fields(record, detailed: bool) -> dict:
    """is_active, created/updated by + at, deleted_at. Creator / updater names only on the
    detail page, to keep lists light."""
    out = {
        "is_active": record.is_active,
        "created_at": iso(record.created_at),
        "updated_at": iso(record.updated_at),
        "deleted_at": iso(record.deleted_at),
    }
    if detailed:
        out["created_by"] = _only(record.creator, "id", "name")
        out["updated_by"] = _only(record.updater, "id", "name")
    return out


def company(c, users_count: int | None = None, detailed: bool = False) -> dict:
    out = {
        "id": c.id, "uuid": c.uuid, "name": c.name, "short_name": c.short_name,
        "gstin": c.gstin, "pan": c.pan, "email": c.email, "phone": c.phone,
        "address": c.address, "city": c.city, "pincode": c.pincode,
    }
    if users_count is not None:
        out["users_count"] = users_count
    return {**out, **audit_fields(c, detailed)}


def user(u, detailed: bool = False) -> dict:
    return {
        "id": u.id, "name": u.name, "username": u.username, "email": u.email, "phone": u.phone,
        "is_first_login": u.is_first_login, "last_login_at": iso(u.last_login_at),
        "roles": [{"id": r.id, "name": r.name} for r in u.roles],
        "companies": [{"id": c.id, "name": c.name, "short_name": c.short_name} for c in u.companies],
        **audit_fields(u, detailed),
    }


def role(r, users_count=None, permissions_count=None, with_permissions: bool = False) -> dict:
    out = {
        "id": r.id, "uuid": r.uuid, "name": r.name,
        "is_super_admin": r.name == settings.super_admin_role,
        # The everyday role: name fixed, cannot be deleted, permissions editable.
        "is_default": r.name == settings.app_default_role,
        "is_admin": r.name == settings.admin_role,  # only the SuperAdmin may change it
    }
    if users_count is not None:
        out["users_count"] = users_count
    if permissions_count is not None:
        out["permissions_count"] = permissions_count
    if with_permissions:
        out["permissions"] = [p.name for p in r.permissions]
    out["created_at"] = iso(r.created_at)
    out["updated_at"] = iso(r.updated_at)
    return out


def activity_log(log) -> dict:
    u = log.user
    return {
        "id": log.id, "uuid": log.uuid, "action": log.action,
        "module": log.loggable_type, "record_id": log.loggable_id,
        "user": None if u is None else {k: v for k, v in
                                        {"id": u.id, "name": u.name, "username": u.username, "email": u.email}.items()
                                        if v is not None},
        "old_values": log.old_values, "new_values": log.new_values,
        "ip_address": str(log.ip_address) if log.ip_address is not None else None,
        "user_agent": log.user_agent, "url": log.url, "method": log.method,
        "created_at": iso(log.created_at),
    }
