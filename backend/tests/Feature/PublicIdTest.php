<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use Tests\TestCase;

/** Records are addressed by uuid (users by id); screens that only link to them must still work. */
class PublicIdTest extends TestCase
{
    public function test_companies_are_addressed_by_uuid_not_id(): void
    {
        $this->actingAs($this->makeSuperAdmin());

        $this->getJson("/api/companies/{$this->main->uuid}")->assertOk()->assertJsonPath('data.short_name', 'MAIN');
        $this->getJson("/api/companies/{$this->main->id}")->assertNotFound();
    }

    public function test_log_detail_links_records_with_a_public_id(): void
    {
        $login = $this->makeUser();
        $this->actingAs($this->makeSuperAdmin());
        $this->postJson('/api/roles', ['name' => 'Supervisor'])->assertCreated();
        $this->patchJson("/api/users/{$login->id}/status", ['is_active' => false])->assertOk();

        // A login has no uuid; a role has one.
        $userLog = ActivityLog::where('loggable_type', 'user')->latest('id')->first();
        $roleLog = ActivityLog::where('loggable_type', 'role')->latest('id')->first();

        $this->getJson("/api/activity-logs/{$userLog->uuid}")->assertOk()->assertJsonPath('record.uuid', null);
        $this->getJson("/api/activity-logs/{$roleLog->uuid}")->assertOk()->assertJsonPath('record.uuid', fn ($uuid) => is_string($uuid));
    }
}
