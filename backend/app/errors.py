"""Errors answered as JSON in Laravel's shape: {"message": ..., "errors": {field: [messages]}}."""
from fastapi import HTTPException


class ValidationFailed(Exception):
    def __init__(self, errors: dict[str, list[str]] | str, field: str | None = None):
        if isinstance(errors, str):
            errors = {field or "body": [errors]}
        self.errors = errors
        super().__init__("The given data was invalid.")

    @property
    def message(self) -> str:
        messages = [m for msgs in self.errors.values() for m in msgs]
        extra = len(messages) - 1
        if extra <= 0:
            return messages[0]
        return f"{messages[0]} (and {extra} more error{'s' if extra > 1 else ''})"


def abort(status: int, message: str):
    raise HTTPException(status_code=status, detail=message)


def abort_if(condition, status: int, message: str) -> None:
    if condition:
        abort(status, message)


def abort_unless(condition, status: int, message: str) -> None:
    if not condition:
        abort(status, message)
