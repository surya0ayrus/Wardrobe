"""Dependencies shared by the routers: who is logged in, permission checks, current company."""
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import session as web_session
from app.db import get_db
from app.errors import abort, abort_if
from app.models import User


class PasswordChangeRequired(Exception):
    """Answered as 403 {"code": "password_change_required"} (see main.py)."""


def auth_user(request: Request, db: Session = Depends(get_db)) -> User:
    """The logged-in user (401 otherwise). A user deactivated while logged in is logged out."""
    user_id = request.session.get("user_id")
    user = db.scalars(select(User).where(User.id == user_id)).first() if user_id else None
    if user is None:
        abort(401, "Unauthenticated.")
    if not user.is_active:
        web_session.invalidate(request)
        abort(403, "Your account is inactive. Please contact the administrator.")
    db.info["user_id"] = user.id
    return user


def current_user(user: User = Depends(auth_user)) -> User:
    """Like auth_user, but blocks a first-login user until they have set their own password."""
    if user.is_first_login:
        raise PasswordChangeRequired()
    return user


# view / viewAny -> view_{resource}; create, update, delete the same.
ABILITIES = {"viewAny": "view", "view": "view", "create": "create", "update": "update", "delete": "delete"}


def authorize(user: User, ability: str, resource: str) -> None:
    """Gate check for "{action}_{resource}" permissions. SuperAdmin passes everything."""
    if not user.can(f"{ABILITIES[ability]}_{resource}"):
        abort(403, "This action is unauthorized.")


def current_company_id(user: User, db: Session) -> int:
    """The company the logged-in user has switched to. Company data is filtered by it.

    It can go missing during a session (company deactivated, user removed from it): then the first
    company the user may access is picked and saved, the same choice the login makes."""
    company_id = user.current_company_id
    if not company_id or not user.can_access_company(company_id):
        company_id = next(iter(user.accessible_company_ids()), None)
        user.current_company_id = company_id
        from app.activity import save_quietly
        save_quietly(db, user)
        db.commit()
    abort_if(not company_id, 409,
             "You do not have access to any active company. Ask an administrator to add you to one.")
    return company_id
