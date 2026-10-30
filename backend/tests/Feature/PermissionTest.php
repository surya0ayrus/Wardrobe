<?php

namespace Tests\Feature;

use App\Models\Role;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PermissionTest extends TestCase
{
    public function test_permission_is_required_and_granted_per_action(): void
    {
        $viewer = $this->makeUser(['view_role']);

        $this->actingAs($viewer)->getJson('/api/roles')->assertOk();
        $this->actingAs($viewer)->postJson('/api/roles', ['name' => 'Supervisor'])->assertStatus(403);
        $this->actingAs($viewer)->getJson('/api/users')->assertStatus(403);
    }

    public function test_super_admin_passes_every_check(): void
    {
        $this->actingAs($this->makeSuperAdmin())
            ->postJson('/api/roles', ['name' => 'Supervisor'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Supervisor');
    }

    public function test_roles_are_managed_from_the_ui_but_super_admin_role_is_fixed(): void
    {
        $admin = $this->makeUser(['view_role', 'view_role', 'create_role', 'update_role', 'delete_role']);
        $this->actingAs($admin);

        $id = $this->postJson('/api/roles', ['name' => 'HR Admin', 'permissions' => ['view_company', 'view_user']])
            ->assertCreated()
            ->assertJsonPath('data.permissions_count', 2)
            ->json('data.id');

        $this->putJson("/api/roles/{$this->uuid('roles', $id)}", ['name' => 'HR Manager', 'permissions' => ['view_user']])
            ->assertOk()->assertJsonPath('data.name', 'HR Manager');

        $superId = Role::where('name', 'SuperAdmin')->value('id');
        $this->putJson("/api/roles/{$this->uuid('roles', $superId)}", ['name' => 'Hacked'])->assertStatus(422);
        $this->deleteJson("/api/roles/{$this->uuid('roles', $superId)}")->assertStatus(422);

        $groups = $this->getJson('/api/permissions')->assertOk()
            ->assertJsonStructure(['actions', 'groups' => [['label', 'resources' => [['key', 'label', 'permissions']]]]])
            ->assertJsonMissingPath('special')
            ->assertJsonPath('groups.1.label', 'User management')
            ->assertJsonPath('groups.1.resources.0.key', 'user')
            ->json('groups');

        // Headings in the order of config/permissions.php (the menu order).
        $this->assertSame(array_keys(config('permissions.groups')), array_column($groups, 'label'));

        // Every configured resource appears exactly once in the groups.
        $keys = collect($this->getJson('/api/permissions')->json('groups'))->flatMap(fn ($g) => collect($g['resources'])->pluck('key'));
        $this->assertEqualsCanonicalizing(array_keys(config('permissions.resources')), $keys->all());
    }

    public function test_only_the_super_admin_changes_the_admin_role(): void
    {
        $admin = Role::where('name', 'Admin')->first();
        $this->assertSame(Permission::count(), $admin->permissions()->count()); // starts with everything

        $this->actingAs($this->makeUser(['update_role']))
            ->putJson("/api/roles/{$admin->uuid}", ['name' => 'Admin', 'permissions' => []])->assertStatus(403);
    }

    public function test_the_default_user_role_keeps_its_name_but_its_permissions_can_change(): void
    {
        $this->actingAs($this->makeUser(['view_role', 'update_role', 'delete_role']));
        $uuid = $this->uuid('roles', Role::where('name', 'User')->value('id'));

        $this->putJson("/api/roles/{$uuid}", ['name' => 'Normal', 'permissions' => []])->assertStatus(422);
        $this->putJson("/api/roles/{$uuid}", ['name' => 'User', 'permissions' => ['view_company', 'view_user']])
            ->assertOk()->assertJsonPath('data.permissions_count', 2);
        $this->deleteJson("/api/roles/{$uuid}")->assertStatus(422);
    }

    public function test_roles_list_shows_counts(): void
    {
        $admin = $this->makeUser(['view_role']);

        $this->actingAs($admin, 'sanctum')->getJson('/api/roles')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'users_count', 'permissions_count']]]);
    }
}
