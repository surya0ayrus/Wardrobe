import uuid as uuid_lib

from fastapi import APIRouter, Body, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import resources, services
from app.db import get_db
from app.deps import authorize, current_user
from app.errors import ValidationFailed, abort, abort_if
from app.listquery import paginate
from app.models import Company, User
from app.schemas import CompanyIn, StatusIn, parse

router = APIRouter(prefix="/api/companies")
"""Companies: the reference CRUD module (list, add, view, edit, Active switch, soft delete).
Copy it as the starting point for a new module."""


def find(db: Session, id: str) -> Company:
    try:
        key = str(uuid_lib.UUID(id))
    except ValueError:
        abort(404, "Not found.")
    company = db.scalars(select(Company).where(Company.uuid == key)).first()
    if company is None:
        abort(404, "Not found.")
    return company


def validated(db: Session, payload: dict, company: Company | None = None) -> dict:
    data = parse(CompanyIn, payload).model_dump()
    data["short_name"] = data["short_name"].strip().upper()
    taken = select(Company.id).where(Company.short_name == data["short_name"])
    if company:
        taken = taken.where(Company.id != company.id)
    if db.scalars(taken).first():
        raise ValidationFailed("The short name has already been taken.", "short_name")
    return data


def one(db: Session, company: Company) -> dict:
    db.refresh(company, ["creator", "updater"])
    count = services.count_company_users(db, [company.id]).get(company.id, 0)
    return {"data": resources.company(company, count, detailed=True)}


@router.get("")
def index(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    authorize(user, "viewAny", "company")
    page = paginate(
        db, select(Company), request, Company,
        searchable=[Company.name, Company.short_name, Company.email, Company.city],
        sortable={"id": Company.id, "name": Company.name, "short_name": Company.short_name,
                  "created_at": Company.created_at},
    )
    counts = services.count_company_users(db, [c.id for c in page.items])
    return page.response([resources.company(c, counts.get(c.id, 0)) for c in page.items])


@router.post("", status_code=201)
def store(payload: dict = Body(default_factory=dict), user: User = Depends(current_user),
          db: Session = Depends(get_db)):
    authorize(user, "create", "company")
    company = Company(**validated(db, payload))
    db.add(company)
    db.commit()
    return one(db, company)


@router.get("/{id}")
def show(id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    company = find(db, id)
    authorize(user, "view", "company")
    return one(db, company)


@router.put("/{id}")
def update(id: str, payload: dict = Body(default_factory=dict), user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    company = find(db, id)
    authorize(user, "update", "company")
    for key, value in validated(db, payload, company).items():
        setattr(company, key, value)
    db.commit()
    return one(db, company)


@router.delete("/{id}", status_code=204)
def destroy(id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    company = find(db, id)
    authorize(user, "delete", "company")
    abort_if(services.count_company_users(db, [company.id]).get(company.id),
             422, "This company has users. Remove them from it first.")
    services.soft_delete(db, company)
    db.commit()
    return Response(status_code=204)


@router.patch("/{id}/status")
def status(id: str, payload: dict = Body(default_factory=dict), user: User = Depends(current_user),
           db: Session = Depends(get_db)):
    """The Active switch in the lists (needs the update permission)."""
    data = parse(StatusIn, payload)
    company = find(db, id)
    authorize(user, "update", "company")
    company.is_active = data.is_active
    db.commit()
    return {"data": {"id": company.id, "is_active": company.is_active}}
