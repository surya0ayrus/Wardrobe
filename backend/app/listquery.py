"""Shared list handling for every index endpoint:
  ?search=abc          contains-search on the given columns
  ?status=active       active | inactive
  ?sort=-name          column, "-" for descending; lists default to -id (newest first).
                       Columns in `natural` sort their digits as numbers (1, 2, 10, G2, G10).
  ?page=2&per_page=25  pagination (max 100)
"""
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi import Request
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session


@dataclass
class Page:
    items: list
    page: int
    per_page: int
    total: int | None  # None for "simple" pagination (no count)
    has_more: bool
    request: Request
    extra: dict = field(default_factory=dict)

    def _url(self, page: int | None) -> str | None:
        return None if page is None else str(self.request.url.include_query_params(page=page))

    def response(self, data: list) -> dict:
        """Laravel's paginated resource collection: {data, links, meta}."""
        count = len(self.items)
        first = (self.page - 1) * self.per_page + 1 if count else None
        last = first + count - 1 if count else None
        path = str(self.request.url.replace(query=""))
        prev_page = self.page - 1 if self.page > 1 else None
        if self.total is None:  # simple pagination: next / previous only
            return {
                "data": data,
                "links": {"first": self._url(1), "last": None, "prev": self._url(prev_page),
                          "next": self._url(self.page + 1) if self.has_more else None},
                "meta": {"current_page": self.page, "from": first, "path": path,
                         "per_page": self.per_page, "to": last},
            }
        last_page = max(-(-self.total // self.per_page), 1)
        return {
            "data": data,
            "links": {"first": self._url(1), "last": self._url(last_page), "prev": self._url(prev_page),
                      "next": self._url(self.page + 1) if self.page < last_page else None},
            "meta": {"current_page": self.page, "from": first, "last_page": last_page, "path": path,
                     "per_page": self.per_page, "to": last, "total": self.total},
        }


def paginate(
    db: Session,
    stmt: Select,
    request: Request,
    model: Any,
    searchable: list | tuple = (),
    sortable: dict[str, Any] | None = None,
    default_sort: str = "-id",
    natural: tuple[str, ...] = (),
    simple: bool = False,
    default_per_page: int = 15,
) -> Page:
    q = request.query_params
    sortable = sortable or {"id": model.id}

    search = (q.get("search") or "").strip()
    if search and searchable:
        term = "%" + re.sub(r"([%_\\])", r"\\\1", search) + "%"
        stmt = stmt.where(or_(*[col.ilike(term, escape="\\") for col in searchable]))

    status = q.get("status")
    if status in ("active", "inactive"):
        stmt = stmt.where(model.is_active.is_(status == "active"))

    sort = q.get("sort") or default_sort
    column = sort.lstrip("-")
    if column not in sortable:
        sort = default_sort
        column = default_sort.lstrip("-")
    expr = sortable[column]
    if column in natural:
        expr = expr.collate("natural_sort")
    stmt = stmt.order_by(expr.desc() if sort.startswith("-") else expr.asc())
    if column != "id":
        stmt = stmt.order_by(model.id)  # stable order between pages

    try:
        per_page = min(max(int(q.get("per_page", default_per_page)), 1), 100)
    except ValueError:
        per_page = default_per_page
    try:
        page = max(int(q.get("page", 1)), 1)
    except ValueError:
        page = 1

    if simple:  # no count(*) on a table that keeps growing: ask for one extra row instead
        rows = list(db.scalars(stmt.limit(per_page + 1).offset((page - 1) * per_page)).unique())
        return Page(rows[:per_page], page, per_page, None, len(rows) > per_page, request)

    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = list(db.scalars(stmt.limit(per_page).offset((page - 1) * per_page)).unique())
    return Page(items, page, per_page, total, page * per_page < total, request)
