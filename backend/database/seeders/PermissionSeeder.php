<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Makes the permissions table match config/permissions.php (adds new ones, deletes
 * ones no longer listed, which also takes them off every role) and creates the
 * fixed roles. Runs on every deploy; safe to run again.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $names = [];
        foreach (config('permissions.resources') as $resource => $item) {
            foreach ($item['actions'] as $action) {
                $names[] = "{$action}_{$resource}";
            }
        }
        $existing = Permission::where('guard_name', 'web')->pluck('name')->all();
        $now = now();
        Permission::insert(collect($names)->diff($existing)->map(fn ($name) => [
            'name' => $name, 'guard_name' => 'web', 'created_at' => $now, 'updated_at' => $now,
        ])->values()->all());

        // role_has_permissions / model_has_permissions rows go with them (cascade).
        Permission::where('guard_name', 'web')->whereNotIn('name', $names)->delete();

        // SuperAdmin needs no permissions assigned: it passes every check (Gate::before).
        Role::firstOrCreate(['name' => config('base.super_admin_role'), 'guard_name' => 'web']);
        // The everyday role; starts without permissions (ticked on the Roles page).
        Role::firstOrCreate(['name' => config('base.default_role'), 'guard_name' => 'web']);
        // Admin starts with every permission; after that only the SuperAdmin changes it.
        $admin = Role::firstOrCreate(['name' => config('base.admin_role'), 'guard_name' => 'web']);
        if ($admin->wasRecentlyCreated) {
            $admin->syncPermissions($names);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Cache::forget('lookups:roles'); // the roles dropdown, in case a fixed role was just added
    }
}
