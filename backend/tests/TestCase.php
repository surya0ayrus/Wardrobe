<?php

namespace Tests;

use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected Company $main;

    protected Company $other;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PermissionSeeder::class);
        $this->main = Company::create(['short_name' => 'MAIN', 'name' => 'Main Company']);
        $this->other = Company::create(['short_name' => 'OTHER', 'name' => 'Other Company']);
    }

    /**
     * A user in the given companies, holding the given permissions.
     */
    protected function makeUser(array $permissions = [], ?array $companies = null, array $attributes = []): User
    {
        static $n = 0;
        $n++;
        $companies ??= [$this->main];

        $user = User::create([
            'name' => $attributes['name'] ?? "Person {$n}",
            'username' => $attributes['username'] ?? "person{$n}",
            'email' => "person{$n}@example.com",
            'password' => $attributes['password'] ?? 'Secret@123',
            'is_first_login' => $attributes['is_first_login'] ?? false,
            'is_active' => $attributes['is_active'] ?? true,
            'current_company_id' => $companies[0]->id ?? null,
        ]);
        $user->companies()->sync(collect($companies)->pluck('id'));

        if ($permissions) {
            $role = Role::create(['name' => "Role {$n}", 'guard_name' => 'web']);
            $role->givePermissionTo($permissions);
            $user->assignRole($role);
        }

        // Re-read from the database, like a real request would.
        return $user->fresh();
    }

    protected function makeSuperAdmin(): User
    {
        $user = $this->makeUser();
        $user->assignRole(config('base.super_admin_role'));

        return $user;
    }

    /** The public uuid of a row, for URLs (records are addressed by uuid, not id). */
    protected function uuid(string $table, int $id): string
    {
        return DB::table($table)->where('id', $id)->value('uuid');
    }
}
