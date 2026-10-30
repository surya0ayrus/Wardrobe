<?php

namespace Tests\Feature;

use App\Models\Role;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class LookupTest extends TestCase
{
    public function test_lookup_is_cached_and_cleared_when_data_changes(): void
    {
        $this->actingAs($this->makeUser());
        $count = Role::count();

        $this->getJson('/api/lookups/roles')->assertOk()->assertJsonCount($count);
        $this->assertTrue(Cache::has('lookups:roles'));

        // Served from cache: no query to the roles table.
        DB::enableQueryLog();
        $this->getJson('/api/lookups/roles')->assertOk();
        $this->assertEmpty(collect(DB::getQueryLog())->filter(fn ($q) => str_contains($q['query'], 'from "roles"')));

        Role::create(['name' => 'Supervisor', 'guard_name' => 'web']);
        $this->assertFalse(Cache::has('lookups:roles'));
        $this->getJson('/api/lookups/roles')->assertJsonCount($count + 1);
    }

    public function test_user_lookup_is_per_company(): void
    {
        $viewer = $this->makeUser(attributes: ['name' => 'Ravi Kumar']);
        $this->makeUser(companies: [$this->other], attributes: ['name' => 'Ravi Shankar']);

        $this->actingAs($viewer)->getJson('/api/lookups/users?search=ravi')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.name', 'Ravi Kumar');
    }

    public function test_company_lookup_lists_only_reachable_companies(): void
    {
        $this->actingAs($this->makeUser())->getJson('/api/lookups/companies')
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.short_name', 'MAIN');

        $this->actingAs($this->makeSuperAdmin())->getJson('/api/lookups/companies')->assertJsonCount(2);
    }
}
