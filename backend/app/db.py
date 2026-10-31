"""Engine, session and the shared declarative base (with the soft-delete filter)."""
from collections.abc import Iterator
from datetime import datetime

from fastapi import Request
from sqlalchemy import DateTime, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker, with_loader_criteria

from app.config import settings

# Store and read all times in UTC, whatever the database server's own timezone is.
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"options": "-c timezone=UTC"},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class SoftDeletes:
    """Rows are marked deleted_at instead of removed; every SELECT hides them
    (use .execution_options(include_deleted=True) to see them)."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


@event.listens_for(Session, "do_orm_execute")
def _hide_soft_deleted(state):
    if (
        state.is_select
        and not state.is_column_load
        and not state.is_relationship_load
        and not state.execution_options.get("include_deleted", False)
    ):
        state.statement = state.statement.options(
            with_loader_criteria(SoftDeletes, lambda cls: cls.deleted_at.is_(None), include_aliases=True)
        )


def get_db(request: Request) -> Iterator[Session]:
    """One session per request. Writes commit explicitly in the endpoint."""
    db = SessionLocal()
    # Request details the activity log stores with every row.
    db.info.update(
        user_id=None,
        ip=request.client.host if request.client else None,
        user_agent=(request.headers.get("user-agent") or "")[:500] or None,
        url=str(request.url),
        method=request.method,
    )
    try:
        yield db
    finally:
        db.rollback()
        db.close()
