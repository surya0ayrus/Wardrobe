import re

from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app import activity, cache
from app import session as web_session
from app.activity import save_quietly, utcnow
from app.db import get_db
from app.deps import auth_user, current_user
from app.errors import ValidationFailed, abort, abort_unless
from app.models import User
from app.schemas import CompanySwitchIn, LoginIn, PreferencesIn, parse
from app.security import check_password

router = APIRouter(prefix="/api/auth")


def session_data(user: User) -> dict:
    """Everything the React app needs after login: who, which companies, what they may do."""
    return {
        "user": {
            "id": user.id, "name": user.name, "username": user.username, "email": user.email,
            "must_change_password": user.is_first_login, "is_super_admin": user.is_super_admin(),
        },
        "roles": user.role_names(),
        "permissions": user.permission_names(),
        "companies": [{"id": c.id, "name": c.name, "short_name": c.short_name} for c in user.accessible_companies()],
        "current_company_id": user.current_company_id,
        "preferences": user.preferences(),
    }


@router.post("/login")
def login(request: Request, payload: dict = Body(default_factory=dict), db: Session = Depends(get_db)):
    """One field accepts the username or the email."""
    data = parse(LoginIn, payload)
    login_name = data.login.strip().lower()

    # Throttle: 5 attempts a minute per login + IP.
    key = f"login:{login_name}|{request.client.host if request.client else ''}"
    if cache.store.incr(key, 60) > 5:
        from fastapi.responses import JSONResponse
        return JSONResponse({"message": "Too Many Attempts."}, status_code=429,
                            headers={"Retry-After": str(max(cache.store.ttl(key), 1))})

    user = db.scalars(select(User).where(or_(User.username == login_name, User.email == login_name))).first()

    if user is None or not check_password(data.password, user.password):
        # Recorded for security review (shown as high risk in the activity log).
        activity.log(db, "login_failed", user, None, {"login": login_name})
        db.commit()  # keep the row although the request ends with an error
        raise ValidationFailed("Invalid username/email or password.", "login")

    if not user.is_active:
        raise ValidationFailed("Your account is inactive. Please contact the administrator.", "login")

    web_session.login(request, user.id, bool(data.remember))
    db.info["user_id"] = user.id

    # Keep the last company if still allowed, otherwise pick the first one.
    if not user.current_company_id or not user.can_access_company(user.current_company_id):
        user.current_company_id = next(iter(user.accessible_company_ids()), None)
    user.last_login_at = utcnow()
    save_quietly(db, user)

    activity.log(db, "login", user)
    db.commit()
    return session_data(user)


@router.post("/logout")
def logout(request: Request, user: User = Depends(auth_user), db: Session = Depends(get_db)):
    activity.log(db, "logout", user)
    db.commit()
    web_session.invalidate(request)
    return {"message": "Logged out."}


@router.get("/me")
def me(user: User = Depends(auth_user)):
    return session_data(user)


@router.put("/password")
def change_password(payload: dict = Body(default_factory=dict), user: User = Depends(auth_user),
                    db: Session = Depends(get_db)):
    """Change own password (also the forced change on first login)."""
    from app.schemas import clean_input

    data = clean_input(payload if isinstance(payload, dict) else {})
    current, new, confirm = data.get("current_password"), data.get("password"), data.get("password_confirmation")
    errors: dict[str, list[str]] = {}

    if not isinstance(current, str):
        errors["current_password"] = ["The current password field is required."]
    elif not check_password(current, user.password):
        errors["current_password"] = ["The password is incorrect."]

    pw_errors = []
    if not isinstance(new, str):
        pw_errors.append("The password field is required.")
    else:
        if new != confirm:
            pw_errors.append("The password field confirmation does not match.")
        if new == current:
            pw_errors.append("The password field and current password must be different.")
        if len(new) < 8:
            pw_errors.append("The password field must be at least 8 characters.")
        if not re.search(r"[A-Za-z]", new):
            pw_errors.append("The password field must contain at least one letter.")
        if not re.search(r"\d", new):
            pw_errors.append("The password field must contain at least one number.")
    if pw_errors:
        errors["password"] = pw_errors
    if errors:
        raise ValidationFailed(errors)

    user.password = new
    user.is_first_login = False
    save_quietly(db, user)
    activity.log(db, "password_changed", user)
    db.commit()
    return session_data(user)


@router.put("/preferences")
def update_preferences(payload: dict = Body(default_factory=dict), user: User = Depends(auth_user),
                       db: Session = Depends(get_db)):
    """Save own layout / theme choice. Send only what changed. Not written to the activity log
    (personal display setting)."""
    data = parse(PreferencesIn, payload).model_dump(exclude_none=True)
    user.settings = {**(user.settings or {}), **data}
    save_quietly(db, user)
    db.commit()
    return {"preferences": user.preferences()}


@router.put("/company")
def switch_company(payload: dict = Body(default_factory=dict), user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    data = parse(CompanySwitchIn, payload)
    abort_unless(user.can_access_company(data.company_id), 403, "You do not have access to this company.")
    user.current_company_id = data.company_id
    save_quietly(db, user)
    db.commit()
    return {"current_company_id": user.current_company_id}
