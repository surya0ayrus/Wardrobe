<?php

namespace Tests\Feature;

use Tests\TestCase;

class CompanyTest extends TestCase
{
    public function test_full_crud_with_permissions(): void
    {
        $this->actingAs($this->makeUser(['view_company', 'create_company', 'update_company', 'delete_company']));

        $uuid = $this->postJson('/api/companies', ['name' => 'New Co', 'short_name' => ' newco '])
            ->assertCreated()
            ->assertJsonPath('data.short_name', 'NEWCO')
            ->assertJsonPath('data.is_active', true)
            ->json('data.uuid');

        $this->postJson('/api/companies', ['name' => 'Copy', 'short_name' => 'NEWCO'])->assertStatus(422)->assertJsonValidationErrors('short_name');

        $this->putJson("/api/companies/{$uuid}", ['name' => 'New Company', 'short_name' => 'NEWCO', 'city' => 'Chennai'])
            ->assertOk()->assertJsonPath('data.city', 'Chennai');
        $this->patchJson("/api/companies/{$uuid}/status", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);

        $this->getJson('/api/companies?search=new')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/companies?status=inactive')->assertJsonCount(1, 'data');

        $this->deleteJson("/api/companies/{$uuid}")->assertNoContent();
        $this->getJson("/api/companies/{$uuid}")->assertNotFound();
        $this->assertDatabaseHas('activity_logs', ['action' => 'deleted', 'loggable_type' => 'company']);
    }

    public function test_a_company_with_users_cannot_be_deleted(): void
    {
        $this->actingAs($this->makeUser(['delete_company']));

        $this->deleteJson("/api/companies/{$this->main->uuid}")->assertStatus(422);
    }

    public function test_view_only_cannot_change(): void
    {
        $this->actingAs($this->makeUser(['view_company']));

        $this->getJson('/api/companies')->assertOk();
        $this->postJson('/api/companies', ['name' => 'X', 'short_name' => 'X'])->assertForbidden();
        $this->patchJson("/api/companies/{$this->main->uuid}/status", ['is_active' => false])->assertForbidden();
    }
}
