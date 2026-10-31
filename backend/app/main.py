from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import session as web_session
from app.config import settings
from app.deps import PasswordChangeRequired
from app.errors import ValidationFailed
from app.routers import auth, companies, misc, roles, users
from app.schemas import translate

app = FastAPI(
    title=settings.app_name,
    docs_url="/api/docs" if settings.app_debug else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.app_debug else None,
)

# Login session (table `sessions`) + CSRF check for the React app.
app.middleware("http")(web_session.session_and_csrf)

for module in (auth, companies, users, roles, misc):
    app.include_router(module.router)


@app.get("/sanctum/csrf-cookie", status_code=204)
def csrf_cookie(request: Request):
    """The React app calls this before logging in; the response sets the XSRF-TOKEN cookie."""
    web_session.ensure_csrf(request)


@app.get("/up", response_class=PlainTextResponse)
def up():
    return "OK"


# ── Errors: always JSON, in Laravel's shape ──────────────────────

@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Error"
    return JSONResponse({"message": message}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(ValidationFailed)
async def validation_failed(request: Request, exc: ValidationFailed):
    return JSONResponse({"message": exc.message, "errors": exc.errors}, status_code=422)


@app.exception_handler(RequestValidationError)
async def request_invalid(request: Request, exc: RequestValidationError):
    errors = translate(exc.errors())
    return JSONResponse({"message": "The given data was invalid.", "errors": errors}, status_code=422)


@app.exception_handler(PasswordChangeRequired)
async def password_change_required(request: Request, exc: PasswordChangeRequired):
    return JSONResponse({"message": "Please change your password to continue.",
                         "code": "password_change_required"}, status_code=403)
