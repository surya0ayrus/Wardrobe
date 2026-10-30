# Base Pack

Starting point for new business apps: a Laravel API and a React app with login, companies,
users, roles & permissions and an activity log already in place. Build each new product's
own modules on top of it.

## What's included

| Area | Backend (`backend/`) | Frontend (`frontend/src/`) |
|---|---|---|
| Login | Session login with Sanctum (username or email), forced password change on first login, inactive accounts blocked, login throttling | `features/auth` |
| Companies | CRUD, Active switch, soft delete; users switch between their companies | `features/companies` (the reference module) |
| Users | CRUD, roles, companies, reset to default password | `features/users` |
| Roles & permissions | spatie/laravel-permission, permission matrix built from `config/permissions.php`; fixed SuperAdmin, Admin and User roles | `features/roles` |
| Activity log | Every create / update / delete, logins and failed logins | `features/activity-logs` |
| Dashboard | One block per module the user may see | `features/dashboard` |
| Shell | — | Top bar or sidebar menu, Ctrl+K search, breadcrumbs, light / dark theme, company switcher |
| UI kit | — | `components/` — DataTable, filters, pagination, forms (react-hook-form + zod), dialogs, date picker, charts |

Shared backend pieces: `ListQuery` (search / status / sort / pagination for every list),
`HasPublicId` (uuid in URLs), `LogsActivity`, `HasAuditColumns` (created_by / updated_by),
`ClearsLookupCache`, `HasGeneratedCode` (codes like `ABC-0001`), `TogglesStatus`, `CrudPolicy`.

Stack: PHP 8.2+ / Laravel 12, PostgreSQL, Redis (production), React 19, Vite, Tailwind 4,
TanStack Query. Docker image: PHP-FPM + Caddy + queue worker + scheduler.

## Setup

```bash
# Backend (http://localhost:8082)
cd backend
cp .env.example .env            # set DB_* (PostgreSQL)
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve --port=8082

# Frontend (http://localhost:5176, proxies /api to the backend)
cd frontend
cp .env.example .env            # VITE_APP_NAME = the product name
npm install
npm run dev
```

Sign in as `superadmin` / `Admin@123` (set `SUPERADMIN_*` in `backend/.env` before seeding).
You must change the password at first login. The seeder also creates one company
(`DEFAULT_COMPANY_*`).

Tests need a PostgreSQL database named `base_app_test`: `cd backend && php artisan test`.

## Adding a module

Companies is the reference module; copy it. For a module called `widget`:

**Backend**
1. Migration with `uuid`, `is_active`, `created_by` / `updated_by`, timestamps, soft deletes.
2. Model with `HasPublicId, HasAuditColumns, LogsActivity, SoftDeletes` (and `ClearsLookupCache` if it feeds a dropdown).
3. Add `'widget' => Models\Widget::class` to the morph map in `AppServiceProvider`.
4. Policy: `class WidgetPolicy extends CrudPolicy { protected string $resource = 'widget'; }`
5. Controller + resource (copy `CompanyController` / `CompanyResource`), routes in `routes/api.php`.
6. Permission in `config/permissions.php` (resource + group), then
   `php artisan db:seed --class=PermissionSeeder` (Docker runs it on every start).
7. Feature test (copy `tests/Feature/CompanyTest.php`).

**Frontend**
1. `features/widgets/` — copy `features/companies/` (list, form, view).
2. Routes in `router.jsx`, menu entry in `layouts/navigation.js` (with its `view_widget` permission).
3. Add `widget` to `modules` in `features/activity-logs/ActivityLogsPage.jsx` and to `recordPages` in `lib/activity.js`.
4. Optional: a block in `DashboardController` and `DashboardPage.jsx`.

## Branding

- Product name: `APP_NAME` (backend `.env`) and `VITE_APP_NAME` (frontend `.env`).
- Logo: `frontend/src/components/ui/Logo.jsx` (an initial + the name until you add a real
  logo to `frontend/public/`), favicon `frontend/public/favicon.svg`.
- Login background: `frontend/public/login-bg.mp4` (video, ~19 MB) and `login-bg.jpg` (shown
  while it loads); both are used by `features/auth/AuthShell.jsx`.
- Colours: `primary`, `secondary`, `accent` and `brand-dark` in the `@theme` block at the top
  of `frontend/src/index.css` (neutral indigo / slate by default).

## Deploying (Docker)

```bash
docker build -t my-app .
docker run -p 8080:8080 --env-file backend/.env my-app
```

The container runs migrations and syncs permissions on start. PostgreSQL and Redis are
external (`DB_*`, `REDIS_*`). See the production block at the end of `backend/.env.example`.
