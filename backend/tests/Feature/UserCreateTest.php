<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserCreateTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Ravi Kumar',
            'username' => 'Ravi.K',
            'email' => 'Ravi@Example.com',
            'role_ids' => [Role::where('name', 'User')->value('id')],
            'company_ids' => [$this->main->id],
            ...$overrides,
        ];
    }

    public function test_admin_creates_a_login_with_the_default_password(): void
    {
        $this->actingAs($this->makeUser(['create_user']));

        $this->postJson('/api/users', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.username', 'ravi.k')
            ->assertJsonPath('data.email', 'ravi@example.com')
            ->assertJsonPath('data.is_first_login', true)
            ->assertJsonPath('data.companies.0.short_name', 'MAIN');

        $user = User::where('username', 'ravi.k')->first();
        $this->assertTrue(Hash::check(config('base.default_password'), $user->password));
        $this->assertTrue($user->hasRole('User'));
        $this->assertSame($this->main->id, $user->current_company_id);
    }

    public function test_cannot_add_users_to_a_company_you_cannot_reach(): void
    {
        $this->actingAs($this->makeUser(['create_user']));

        $this->postJson('/api/users', $this->payload(['company_ids' => [$this->other->id]]))
            ->assertStatus(422)->assertJsonValidationErrors('company_ids');
    }

    public function test_needs_the_permission_and_only_super_admin_gives_super_admin_or_admin(): void
    {
        foreach (['SuperAdmin', 'Admin'] as $role) {
            $payload = $this->payload(['role_ids' => [Role::where('name', $role)->value('id')]]);

            $this->actingAs($this->makeUser(['view_user']))->postJson('/api/users', $payload)->assertForbidden();
            $this->actingAs($this->makeUser(['create_user']))->postJson('/api/users', $payload)->assertForbidden();
        }

        $this->actingAs($this->makeSuperAdmin())->postJson('/api/users', $this->payload(['role_ids' => [Role::where('name', 'Admin')->value('id')]]))
            ->assertCreated();
    }

    public function test_editing_keeps_companies_the_editor_cannot_see(): void
    {
        $person = $this->makeUser(companies: [$this->main, $this->other]);
        $this->actingAs($this->makeUser(['update_user']));

        $this->putJson("/api/users/{$person->id}", $this->payload(['name' => 'Renamed', 'username' => $person->username, 'email' => null]))
            ->assertOk()->assertJsonPath('data.name', 'Renamed');

        $this->assertEqualsCanonicalizing([$this->main->id, $this->other->id], $person->companies()->pluck('companies.id')->all());
        $this->assertDatabaseHas('activity_logs', ['action' => 'updated', 'loggable_type' => 'user', 'loggable_id' => $person->id]);
    }

    public function test_users_of_other_companies_are_not_visible(): void
    {
        $outsider = $this->makeUser(companies: [$this->other]);
        $this->actingAs($this->makeUser(['view_user', 'update_user']));

        $this->getJson("/api/users/{$outsider->id}")->assertNotFound();
        $this->assertCount(1, $this->getJson('/api/users')->json('data'));
    }

    public function test_reset_password_forces_a_change_at_next_login(): void
    {
        $person = $this->makeUser();
        $this->actingAs($this->makeUser(['update_user']));

        $this->postJson("/api/users/{$person->id}/reset-password")->assertOk();

        $person->refresh();
        $this->assertTrue($person->is_first_login);
        $this->assertTrue(Hash::check(config('base.default_password'), $person->password));
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_reset', 'loggable_id' => $person->id]);
    }

    public function test_cannot_deactivate_yourself(): void
    {
        $me = $this->makeUser(['update_user']);

        $this->actingAs($me)->patchJson("/api/users/{$me->id}/status", ['is_active' => false])->assertStatus(422);
    }
}
