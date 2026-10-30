<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Tests\TestCase;

class AuthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Browsers send this; it tells Sanctum the request comes from the web app.
        $this->withHeader('Origin', 'http://localhost:5176');
    }

    public function test_login_with_username_or_email_in_any_case(): void
    {
        $this->makeUser(attributes: ['username' => 'ravi']);

        $this->postJson('/api/auth/login', ['login' => 'RAVI', 'password' => 'Secret@123'])
            ->assertOk()
            ->assertJsonPath('user.username', 'ravi')
            ->assertJsonPath('current_company_id', $this->main->id);

        $this->postJson('/api/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $user = User::where('username', 'ravi')->first();
        $this->postJson('/api/auth/login', ['login' => strtoupper($user->email), 'password' => 'Secret@123'])
            ->assertOk();
    }

    public function test_wrong_password_and_inactive_account_are_rejected(): void
    {
        $this->makeUser(attributes: ['username' => 'ravi']);
        $this->makeUser(attributes: ['username' => 'off', 'is_active' => false]);

        $this->postJson('/api/auth/login', ['login' => 'ravi', 'password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
        $this->assertDatabaseHas('activity_logs', ['action' => 'login_failed', 'loggable_type' => 'user']);

        $this->postJson('/api/auth/login', ['login' => 'off', 'password' => 'Secret@123'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
    }

    public function test_users_change_their_own_password(): void
    {
        $this->actingAs($this->makeUser());

        $this->putJson('/api/auth/password', ['current_password' => 'Secret@123', 'password' => 'NewPass123', 'password_confirmation' => 'NewPass123'])
            ->assertOk();
    }

    public function test_a_new_login_must_change_password_before_anything_else(): void
    {
        $this->actingAs($this->makeUser(['view_user'], attributes: ['is_first_login' => true]));

        $this->getJson('/api/users')->assertStatus(403)->assertJsonPath('code', 'password_change_required');
        $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('user.must_change_password', true);

        $this->putJson('/api/auth/password', [
            'current_password' => 'Secret@123',
            'password' => 'NewPass123',
            'password_confirmation' => 'NewPass123',
        ])->assertOk()->assertJsonPath('user.must_change_password', false);

        $this->getJson('/api/users')->assertOk();
    }

    public function test_members_of_two_companies_can_switch(): void
    {
        $both = $this->makeUser(companies: [$this->main, $this->other]);

        $this->actingAs($both)->putJson('/api/auth/company', ['company_id' => $this->other->id])
            ->assertOk()->assertJsonPath('current_company_id', $this->other->id);
    }

    public function test_cannot_switch_to_a_company_you_do_not_belong_to(): void
    {
        $onlyMain = $this->makeUser();

        $this->actingAs($onlyMain)->putJson('/api/auth/company', ['company_id' => $this->other->id])
            ->assertStatus(403);
    }

    public function test_deactivated_user_is_blocked_on_next_request(): void
    {
        $user = $this->makeUser();
        $user->update(['is_active' => false]);

        $this->actingAs($user)->getJson('/api/auth/me')->assertStatus(403);
    }

    public function test_preferences_default_and_can_be_changed(): void
    {
        $user = $this->makeUser();
        $this->actingAs($user);

        $this->getJson('/api/auth/me')->assertJsonPath('preferences', ['nav_style' => 'top', 'theme' => 'system']);

        $this->putJson('/api/auth/preferences', ['theme' => 'dark'])
            ->assertOk()->assertJsonPath('preferences', ['nav_style' => 'top', 'theme' => 'dark']);
        $this->putJson('/api/auth/preferences', ['nav_style' => 'side'])
            ->assertJsonPath('preferences', ['nav_style' => 'side', 'theme' => 'dark']);

        $this->putJson('/api/auth/preferences', ['theme' => 'purple'])->assertStatus(422);
        $this->assertSame(0, ActivityLog::where('action', 'updated')->where('loggable_type', 'user')->count());
    }

    public function test_saved_times_match_the_real_clock(): void
    {
        $this->travelTo(now()); // freeze "now"
        $user = $this->makeUser();

        $log = ActivityLog::where('loggable_type', 'user')->where('loggable_id', $user->id)->first()
            ?? ActivityLog::latest('id')->first();

        // Read back from the database: must be the same moment, not shifted by the server timezone.
        $this->assertLessThan(5, abs($user->fresh()->created_at->diffInSeconds(now())));
        $this->assertLessThan(5, abs($log->fresh()->created_at->diffInSeconds(now())));
    }
}
