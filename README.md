# Base Pack (Python + React)

Starting point for new business apps: a **FastAPI** API and a React app with login, companies,
users, roles & permissions and an activity log already in place. The React app is unchanged from
the Laravel version: the Python API answers the same URLs with the same JSON.

## Backend layout (`backend/app/`)

| File | What it is (Laravel equivalent) |
|---|---|
| `main.py` | App, error handlers, `/sanctum/csrf-cookie`, `/up` (`bootstrap/app.php`) |
| `config.py`, `permissions_config.py` | Settings and the permission list (`config/base.php`, `config/permissions.php`) |
| `models.py` | Tables: User, Company, Role, Permission, ActivityLog (Eloquent models) |
| `activity.py` | Activity log + model hooks: `logs_activity`, `has_audit_columns`, `clears_lookup_cache` |
| `session.py` | DB-backed login sessions and CSRF check (Sanctum SPA auth) |
| `deps.py` | Logged-in user, `authorize()` permission check, current company (middleware, policies, `CurrentCompany`) |
| `listquery.py` | Search / status / sort / pagination for every list (`ListQuery`) |
| `schemas.py` | Request validation with Laravel-style messages (`$request->validate`) |
| `resources.py` | JSON shapes (API Resources) |
| `routers/` | auth, companies (the reference module), users, roles, misc (permissions, lookups, activity logs, dashboard, health) |
| `seed.py` | Permissions, first company, SuperAdmin (seeders) |
| `generated_code.py` | Codes like `ABC-0001` (`HasGeneratedCode`) |

Passwords use the same bcrypt format as Laravel, and table / column names are unchanged.

## Setup (VS Code)

Needs Python 3.11+, PostgreSQL and Node. Open the folder in VS Code (install the recommended extensions).

```bash
# Backend (http://localhost:8082)
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # set DB_* (PostgreSQL)
alembic upgrade head               # create the tables
python -m app.seed                 # permissions, first company, SuperAdmin
uvicorn app.main:app --reload --port 8082

# Frontend (http://localhost:5176, proxies /api and /sanctum to the backend)
cd frontend
cp .env.example .env
npm install
npm run dev
```

In VS Code: **Run and Debug → "Full app (API + Frontend)"** starts both with the debugger attached;
**Terminal → Run Task** has install / migrate / test. API docs (debug mode only): http://localhost:8082/api/docs

Sign in as `superadmin` / `Admin@123` (set `SUPERADMIN_*` in `backend/.env` before seeding).
You must change the password at first login.

Tests need a PostgreSQL database named `base_app_test` (`DB_*` from `.env` are used):
`cd backend && pytest`. The tests build the schema with the real migrations.

### Using your existing Laravel database
The tables are the same, so you can point `DB_*` at the existing database and run
`alembic stamp head` (instead of `upgrade head`), then `python -m app.seed permissions`.
Existing logins keep working. Old browser sessions are not valid: everyone logs in once again.

## Adding a module

Companies is the reference module; copy it. For a module called `widget`:

**Backend**
1. Model in `models.py` (decorators `@logs_activity @has_audit_columns`, mixin `SoftDeletes`, `uuid` column like Company; `@clears_lookup_cache` if it feeds a dropdown).
2. `alembic revision --autogenerate -m "widgets"` and `alembic upgrade head`.
3. Add `"widget": Widget` to `MORPH_MAP` at the end of `models.py`.
4. Router: copy `routers/companies.py`, include it in `main.py`; add the request model to `schemas.py` and a serializer to `resources.py`.
5. Permission in `permissions_config.py` (resource + group), then `python -m app.seed permissions` (Docker runs it on every start).
6. Test: copy `tests/test_company.py`.

**Frontend**: same as before (`features/widgets/`, `router.jsx`, `layouts/navigation.js`, activity-log lists).

## Deploying (Docker)

```bash
docker build -t my-app .
docker run -p 8080:8080 --env-file backend/.env my-app
```
The container runs migrations and syncs permissions on start. PostgreSQL and Redis are external
(`DB_*`, `REDIS_*`). Set `CACHE_STORE=redis` in production: the API runs 2 worker processes, and
the dropdown cache / login throttle must be shared between them.
