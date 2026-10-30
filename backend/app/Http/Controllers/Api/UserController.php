<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\TogglesStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\CurrentCompany;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Logins. New users get the default password (changed at first login), one or more roles and
 * the companies they may switch to. Users are addressed by id (they have no public uuid).
 */
class UserController extends Controller
{
    use TogglesStatus;

    public function index(Request $request)
    {
        $this->authorize('viewAny', User::class);

        $query = $this->visibleQuery($request)
            ->with('roles:id,name', 'companies:id,name,short_name')
            ->when($request->integer('role_id') ?: null, fn ($q, $id) => $q->whereHas('roles', fn ($r) => $r->whereKey($id)));

        return UserResource::collection(ListQuery::paginate(
            $query, $request,
            searchable: ['users.name', 'users.username', 'users.email', 'users.phone'],
            sortable: ['id', 'name', 'username', 'last_login_at', 'created_at'],
            defaultSort: '-id', // newest first, like every list
        ));
    }

    public function store(Request $request): UserResource
    {
        $this->authorize('create', User::class);

        $data = $this->validated($request);
        $this->guardRoles($request, $data['role_ids']);
        $this->guardCompanies($request, $data['company_ids']);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                ...collect($data)->only('name', 'username', 'email', 'phone')->all(),
                'password' => config('base.default_password'),
                'is_first_login' => true,
                'current_company_id' => $data['company_ids'][0],
            ]);
            $user->syncRoles($data['role_ids']);
            $user->companies()->sync($data['company_ids']);

            return $user;
        });

        return $this->resource($user);
    }

    public function show(Request $request, int $id): UserResource
    {
        $user = $this->find($request, $id);
        $this->authorize('view', $user);

        return $this->resource($user);
    }

    public function update(Request $request, int $id): UserResource
    {
        $user = $this->find($request, $id);
        $this->authorize('update', $user);
        $this->guardSuperAdmin($request, $user);

        $data = $this->validated($request, $user);
        $this->guardRoles($request, $data['role_ids']);
        $this->guardCompanies($request, $data['company_ids'], $user);

        $old = ['roles' => $user->roles()->pluck('name')->sort()->values()->all(), 'companies' => $user->companies()->pluck('short_name')->sort()->values()->all()];

        DB::transaction(function () use ($user, $data) {
            $user->update(collect($data)->only('name', 'username', 'email', 'phone')->all());
            $user->syncRoles($data['role_ids']);
            $user->companies()->sync($data['company_ids']);
        });

        $new = ['roles' => $user->roles()->pluck('name')->sort()->values()->all(), 'companies' => $user->companies()->pluck('short_name')->sort()->values()->all()];
        if ($old != $new) {
            ActivityLogger::log('roles_updated', $user, $old, $new);
        }

        return $this->resource($user);
    }

    /** Back to the default password; the user must change it at the next login. */
    public function resetPassword(Request $request, int $id): JsonResponse
    {
        $user = $this->find($request, $id);
        $this->authorize('update', $user);
        $this->guardSuperAdmin($request, $user);

        $user->forceFill(['password' => config('base.default_password'), 'is_first_login' => true])->saveQuietly();
        ActivityLogger::log('password_reset', $user);

        return response()->json(['message' => 'Password reset to the default password.']);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function validated(Request $request, ?User $user = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:50', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('users')->withoutTrashed()->ignore($user?->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users')->withoutTrashed()->ignore($user?->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', Rule::exists('roles', 'id')],
            'company_ids' => ['required', 'array', 'min:1'],
            'company_ids.*' => ['integer', Rule::exists('companies', 'id')->whereNull('deleted_at')],
        ]);
        $data['company_ids'] = array_values(array_unique($data['company_ids']));

        return $data;
    }

    protected function statusRecord(Request $request, string $id): Model
    {
        return $this->find($request, (int) $id);
    }

    protected function applyStatus(Request $request, Model $user, bool $active): void
    {
        $this->guardSuperAdmin($request, $user);
        abort_if(! $active && $user->is($request->user()), 422, 'You cannot deactivate your own account.');

        $user->update(['is_active' => $active]);
    }

    /** Users of the current company; SuperAdmins also see logins without a company (e.g. themselves). */
    private function visibleQuery(Request $request): Builder
    {
        $viewer = $request->user();
        $companyId = CurrentCompany::id();

        return User::query()->where(function ($q) use ($viewer, $companyId) {
            $q->inCompany($companyId);

            if ($viewer->isSuperAdmin()) {
                $q->orWhereDoesntHave('companies');
            }
        });
    }

    private function find(Request $request, int $id): User
    {
        return $this->visibleQuery($request)->findOrFail($id);
    }

    private function guardRoles(Request $request, array $roleIds): void
    {
        if ($request->user()->isSuperAdmin()) {
            return;
        }
        // SuperAdmin and Admin have every permission: only the SuperAdmin may give them out.
        $fixed = Role::whereIn('name', [config('base.super_admin_role'), config('base.admin_role')])->pluck('id')->all();
        abort_if(array_intersect($fixed, $roleIds), 403, 'Only a SuperAdmin can assign the SuperAdmin or Admin role.');
    }

    /**
     * Only companies the editor can reach may be given. Companies of the user the editor cannot
     * reach are kept as they are (an admin of one company does not remove someone from another).
     */
    private function guardCompanies(Request $request, array &$companyIds, ?User $user = null): void
    {
        $reachable = $request->user()->accessibleCompanyIds();
        if (array_diff($companyIds, $reachable)) {
            throw ValidationException::withMessages(['company_ids' => 'You can only add users to companies you have access to.']);
        }
        if ($user) {
            $hidden = array_diff($user->companies()->pluck('companies.id')->all(), $reachable);
            $companyIds = array_values(array_unique([...$companyIds, ...$hidden]));
        }
    }

    private function guardSuperAdmin(Request $request, User $user): void
    {
        abort_if($user->isSuperAdmin() && ! $request->user()->isSuperAdmin(), 403, 'Only a SuperAdmin can change a SuperAdmin login.');
    }

    private function resource(User $user): UserResource
    {
        return new UserResource($user->load('roles:id,name', 'companies:id,name,short_name', 'creator:id,name', 'updater:id,name'));
    }
}
