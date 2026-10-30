<?php

namespace Tests\Feature;

use Tests\TestCase;

/** Company data needs a current company; a missing one is filled in instead of an empty page. */
class CurrentCompanyTest extends TestCase
{
    public function test_a_missing_current_company_falls_back_to_the_first_accessible_one(): void
    {
        $admin = $this->makeSuperAdmin();
        $admin->forceFill(['current_company_id' => null])->saveQuietly();

        $this->actingAs($admin)->getJson('/api/users')->assertOk();

        $this->assertSame($this->main->id, $admin->fresh()->current_company_id);
    }

    public function test_a_company_the_user_lost_access_to_is_replaced(): void
    {
        $user = $this->makeUser(['view_user'], companies: [$this->main, $this->other]);
        $user->forceFill(['current_company_id' => $this->other->id])->saveQuietly();
        $user->companies()->detach($this->other->id);

        $this->actingAs($user)->getJson('/api/users')->assertOk();

        $this->assertSame($this->main->id, $user->fresh()->current_company_id);
    }
}
