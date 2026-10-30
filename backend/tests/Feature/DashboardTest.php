<?php

namespace Tests\Feature;

use Tests\TestCase;

class DashboardTest extends TestCase
{
    public function test_user_counts_follow_company_and_permissions(): void
    {
        $viewer = $this->makeUser(['view_user']);
        $this->makeUser(attributes: ['is_active' => false]);
        $this->makeUser(companies: [$this->other]); // other company: not counted

        $this->actingAs($viewer)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('users.total', 2)
            ->assertJsonPath('users.active', 1)
            ->assertJsonPath('users.inactive', 1)
            ->assertJsonMissingPath('recent_activity');
    }

    public function test_blocks_need_their_permission(): void
    {
        $this->actingAs($this->makeUser(['view_activity_log']))->getJson('/api/dashboard')->assertOk()
            ->assertJsonMissingPath('users')
            ->assertJsonStructure(['recent_activity']);
    }
}
