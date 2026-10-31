"""Login sessions kept in the `sessions` table, plus CSRF protection for the React app.

The browser holds a random session id in an HttpOnly cookie. The React app (axios) first calls
GET /sanctum/csrf-cookie, which sets the readable XSRF-TOKEN cookie; axios sends it back in the
X-XSRF-TOKEN header on every POST/PUT/PATCH/DELETE (same flow as Laravel Sanctum's SPA login)."""
import json
import random
import secrets
import time

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.db import SessionLocal
from app.models import SessionRecord

COOKIE = settings.session_cookie_name
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _lifetime(data: dict) -> int:
    return settings.remember_days * 86400 if data.get("remember") else settings.session_lifetime * 60


def _load(sid: str | None):
    if not sid:
        return None
    with SessionLocal() as db:
        row = db.get(SessionRecord, sid)
        if row is None:
            return None
        data = json.loads(row.payload or "{}")
        if row.last_activity < int(time.time()) - _lifetime(data):
            db.delete(row)
            db.commit()
            return None
        return data, row.last_activity


def _persist(sid, data, snapshot, last_activity, rotate, ip, user_agent):
    """Returns ('set', id) / ('delete', None) / (None, None)."""
    now = int(time.time())
    with SessionLocal() as db:
        if rotate and sid:
            row = db.get(SessionRecord, sid)
            if row:
                db.delete(row)
            sid = None
        action = (None, None)
        if data:
            changed = sid is None or json.dumps(data, sort_keys=True) != snapshot
            if changed or now - last_activity > 60:
                sid = sid or secrets.token_urlsafe(40)
                row = db.get(SessionRecord, sid) or SessionRecord(id=sid)
                row.user_id = data.get("user_id")
                row.ip_address = ip
                row.user_agent = (user_agent or "")[:500] or None
                row.payload = json.dumps(data)
                row.last_activity = now
                db.add(row)
            action = ("set", sid)
        elif sid:
            row = db.get(SessionRecord, sid)
            if row:
                db.delete(row)
            action = ("delete", None)
        if random.random() < 0.02:  # now and then, drop expired sessions
            oldest = now - max(settings.session_lifetime * 60, settings.remember_days * 86400)
            db.query(SessionRecord).filter(SessionRecord.last_activity < oldest).delete()
        db.commit()
        return action


async def session_and_csrf(request: Request, call_next):
    sid = request.cookies.get(COOKIE)
    loaded = await run_in_threadpool(_load, sid)
    data, last_activity = loaded if loaded else ({}, 0)
    if not loaded:
        sid = None
    snapshot = json.dumps(data, sort_keys=True)
    request.scope["session"] = data
    request.scope["session_rotate"] = False

    # CSRF: every write to the API must send the token that GET /sanctum/csrf-cookie handed out.
    token = data.get("csrf")
    header = request.headers.get("x-xsrf-token") or request.headers.get("x-csrf-token")
    if (
        not settings.is_testing
        and request.method not in SAFE_METHODS
        and request.url.path.startswith("/api/")
        and not (token and header and secrets.compare_digest(token, header))
    ):
        response = JSONResponse({"message": "CSRF token mismatch."}, status_code=419)
    else:
        response = await call_next(request)

    rotate = request.scope.get("session_rotate", False)
    client = request.client.host if request.client else None
    action, new_sid = await run_in_threadpool(
        _persist, sid, data, snapshot, last_activity, rotate, client, request.headers.get("user-agent"))

    if action == "set":
        response.set_cookie(
            COOKIE, new_sid, max_age=_lifetime(data), httponly=True,
            samesite=settings.session_same_site, secure=settings.session_secure_cookie, path="/")
    elif action == "delete":
        response.delete_cookie(COOKIE, path="/")
    if data.get("csrf"):
        response.set_cookie(
            "XSRF-TOKEN", data["csrf"], max_age=_lifetime(data), httponly=False,
            samesite=settings.session_same_site, secure=settings.session_secure_cookie, path="/")
    return response


# ── Helpers used by the endpoints ────────────────────────────────

def ensure_csrf(request: Request) -> None:
    request.session.setdefault("csrf", secrets.token_urlsafe(40))


def login(request: Request, user_id: int, remember: bool = False) -> None:
    """Start the session for a user (new session id, so an old id cannot be reused)."""
    request.session["user_id"] = user_id
    request.session["remember"] = bool(remember)
    ensure_csrf(request)
    request.scope["session_rotate"] = True


def invalidate(request: Request) -> None:
    """End the session and give the browser a fresh CSRF token (Laravel: invalidate + regenerateToken)."""
    request.session.clear()
    request.session["csrf"] = secrets.token_urlsafe(40)
    request.scope["session_rotate"] = True
