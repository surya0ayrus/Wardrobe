"""Request validation (Pydantic) with Laravel-style cleaning and error messages.

Like Laravel's TrimStrings + ConvertEmptyStringsToNull: strings are trimmed and "" becomes null
(passwords are not trimmed)."""
from typing import Annotated, Any, Literal, Optional, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, ValidationError
from pydantic_core import PydanticCustomError

from app.errors import ValidationFailed

PASSWORD_FIELDS = {"current_password", "password", "password_confirmation"}
T = TypeVar("T", bound=BaseModel)


def clean_input(value: Any, key: str | None = None) -> Any:
    if isinstance(value, str):
        if key not in PASSWORD_FIELDS:
            value = value.strip()
        return value or None
    if isinstance(value, dict):
        return {k: clean_input(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [clean_input(v, key) for v in value]
    return value


def _message(error: dict, attr: str) -> str:
    kind = error["type"]
    ctx = error.get("ctx") or {}
    if kind == "missing" or error.get("input") is None:
        return f"The {attr} field is required."
    if kind == "string_too_long":
        return f"The {attr} field must not be greater than {ctx.get('max_length')} characters."
    if kind == "string_too_short":
        return f"The {attr} field must be at least {ctx.get('min_length')} characters."
    if kind == "too_short":
        return f"The {attr} field must have at least {ctx.get('min_length')} items."
    if kind == "string_pattern_mismatch":
        return f"The {attr} field format is invalid."
    if kind in ("string_type",):
        return f"The {attr} field must be a string."
    if kind in ("int_type", "int_parsing", "int_from_float"):
        return f"The {attr} field must be an integer."
    if kind in ("bool_type", "bool_parsing"):
        return f"The {attr} field must be true or false."
    if kind in ("list_type", "dict_type"):
        return f"The {attr} field must be an array."
    if kind == "literal_error":
        return f"The selected {attr} is invalid."
    if kind == "value_error" and "email" in error.get("msg", "").lower():
        return f"The {attr} field must be a valid email address."
    return error.get("msg", f"The {attr} field is invalid.")


def translate(errors: list[dict]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for error in errors:
        parts = [str(p) for p in error["loc"] if p not in ("body", "query")]
        key = ".".join(parts) or "body"
        out.setdefault(key, []).append(_message(error, key.replace("_", " ")))
    return out


def parse(model: type[T], payload: Any) -> T:
    """Validate a JSON body; raises ValidationFailed (HTTP 422) like Laravel's $request->validate()."""
    try:
        return model.model_validate(clean_input(payload if isinstance(payload, dict) else {}))
    except ValidationError as exc:
        raise ValidationFailed(translate(exc.errors(include_input=True)))


def max_len(limit: int):
    def check(value: str) -> str:
        if len(value) > limit:
            raise PydanticCustomError("string_too_long", "too long", {"max_length": limit})
        return value
    return AfterValidator(check)


class Req(BaseModel):
    model_config = ConfigDict(extra="ignore")


Str255 = Annotated[str, StringConstraints(max_length=255)]
Email = Annotated[EmailStr, max_len(255)]


class LoginIn(Req):
    login: Str255
    password: str
    remember: Optional[bool] = None


class PreferencesIn(Req):
    nav_style: Optional[Literal["top", "side"]] = None
    theme: Optional[Literal["light", "dark", "system"]] = None


class CompanySwitchIn(Req):
    company_id: int


class StatusIn(Req):
    is_active: bool


class CompanyIn(Req):
    name: Str255
    short_name: Annotated[str, StringConstraints(max_length=20)]
    gstin: Optional[Annotated[str, StringConstraints(max_length=20)]] = None
    pan: Optional[Annotated[str, StringConstraints(max_length=20)]] = None
    email: Optional[Email] = None
    phone: Optional[Annotated[str, StringConstraints(max_length=20)]] = None
    address: Optional[Annotated[str, StringConstraints(max_length=1000)]] = None
    city: Optional[Annotated[str, StringConstraints(max_length=100)]] = None
    pincode: Optional[Annotated[str, StringConstraints(max_length=10)]] = None


class UserIn(Req):
    name: Str255
    username: Annotated[str, StringConstraints(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")]
    email: Optional[Email] = None
    phone: Optional[Annotated[str, StringConstraints(max_length=20)]] = None
    role_ids: list[int] = Field(min_length=1)
    company_ids: list[int] = Field(min_length=1)


class RoleIn(Req):
    name: Annotated[str, StringConstraints(max_length=100)]
    permissions: Optional[list[str]] = None
