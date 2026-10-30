<?php

namespace App\Providers;

use App\Models;
use App\Models\Role;
use App\Policies\RolePolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Spatie\Permission\Models\Permission;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Catch N+1 queries and typos in attribute names while developing.
        Model::shouldBeStrict(! $this->app->isProduction());

        // Short names stored in *_type columns (activity_logs, roles).
        Relation::enforceMorphMap([
            'user' => Models\User::class,
            'company' => Models\Company::class,
            'role' => Role::class,
            'permission' => Permission::class,
        ]);

        Gate::policy(Role::class, RolePolicy::class);

        // SuperAdmin passes every permission check.
        Gate::before(fn (Models\User $user) => $user->isSuperAdmin() ? true : null);

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(mb_strtolower((string) $request->input('login')).'|'.$request->ip()));
    }
}
