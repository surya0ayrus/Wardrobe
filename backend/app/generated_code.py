"""Codes made when a record is saved: a prefix and a number counted per prefix (AOA-0001, PPC-0001 ...).
Never typed, never reused (deleted records keep theirs).

Use in a model: `@generates_code(prefix=lambda m: "AOA")` on a class with a `code` column."""
from sqlalchemy import event, func, select, text
from sqlalchemy.orm import object_session


def next_code(db, model, prefix: str) -> str:
    """Next free code for the prefix. A lock per prefix gives two people saving at once different numbers."""
    db.execute(text("select pg_advisory_xact_lock(hashtext(:k))"), {"k": f"{model.__tablename__}:{prefix}"})
    number = func.cast(func.substring(model.code, text("'[0-9]+$'")), text("integer"))
    last = db.scalar(select(func.max(number)).where(model.code.like(f"{prefix}-%")).execution_options(include_deleted=True))
    return f"{prefix}-{(last or 0) + 1:04d}"


def generates_code(prefix):
    def decorator(cls):
        @event.listens_for(cls, "before_insert")
        @event.listens_for(cls, "before_update")
        def _code(mapper, connection, target):
            p = prefix(target)
            if not target.code or not target.code.startswith(f"{p}-"):
                target.code = next_code(object_session(target), cls, p)
        return cls
    return decorator
