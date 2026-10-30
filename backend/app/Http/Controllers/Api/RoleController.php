<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

/**
 * Roles are created in the UI; permissions are ticked in the permission matrix.
 * The SuperAdmin role is fixed: it cannot be edited or deleted. The default role (User)
 * keeps its name and cannot be deleted; its permissions can change.
 */
class RoleController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', Role::class);

        return RoleResource::collection(
            Role::query()
                ->withCount('users', 'permissions')
                ->when($request->query('search'), fn ($q, $s) => $q->where('name', 'ilike', '%'.addcslashes($s, '%_\\').'%'))
                ->orderByDesc('id') // newest first, like every list
                ->get()
        );
    }

    public function store(Request $request): RoleResource
    {
        $this->authorize('create', Role::class);
        $data = $this->validated($request);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);
        ActivityLogger::log('created', $role, null, $data);

        return $this->done($role);
    }

    public function show(Role $role): RoleResource
    {
        $this->authorize('view', $role);

        return new RoleResource($role->load('permissions:id,name')->loadCount('users', 'permissions'));
    }

    public function update(Request $request, Role $role): RoleResource
    {
        $this->authorize('update', $role);
        $this->ensureEditable($role);
        $data = $this->validated($request, $role);
        abort_if($role->name === config('base.default_role') && $data['name'] !== $role->name, 422,
            'The default role cannot be renamed.');

        $old = ['name' => $role->name, 'permissions' => $role->permissions()->pluck('name')->sort()->values()->all()];

        $role->update(['name' => $data['name']]);
        $role->syncPermissions($data['permissions'] ?? []);

        $new = ['name' => $role->name, 'permissions' => collect($data['permissions'] ?? [])->sort()->values()->all()];
        if ($old != $new) {
            ActivityLogger::log('updated', $role, $old, $new);
        }

        return $this->done($role);
    }

    public function destroy(Role $role): Response
    {
        $this->authorize('delete', $role);
        $this->ensureEditable($role);
        abort_if($role->name === config('base.default_role'), 422, 'The default role cannot be deleted.');
        abort_if($role->users()->exists(), 422, 'This role is assigned to users. Remove it from them first.');

        ActivityLogger::log('deleted', $role, ['name' => $role->name]);
        $role->delete();
        Cache::forget('lookups:roles');

        return response()->noContent();
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('roles')->where('guard_name', 'web')->ignore($role?->id)],
            'permissions' => ['array'],
            'permissions.*' => ['string', Rule::exists('permissions', 'name')->where('guard_name', 'web')],
        ]);
    }

    private function ensureEditable(Role $role): void
    {
        abort_if($role->name === config('base.super_admin_role'), 422, 'The SuperAdmin role cannot be changed.');
        // Admins cannot widen or remove their own role: only the SuperAdmin changes it.
        abort_if($role->name === config('base.admin_role') && ! request()->user()?->isSuperAdmin(), 403, 'Only the SuperAdmin can change the Admin role.');
    }

    private function done(Role $role): RoleResource
    {
        Cache::forget('lookups:roles');

        return $this->show($role);
    }
}
