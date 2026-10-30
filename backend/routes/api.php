<?php

use App\Http\Controllers\Api;
use App\Http\Controllers\Api\Auth;
use Illuminate\Support\Facades\Route;

Route::get('/health', Api\HealthController::class);

// ── Login ────────────────────────────────────────────────────────
Route::post('/auth/login', [Auth\AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    // Allowed even before the first-login password change.
    Route::get('/auth/me', [Auth\AuthController::class, 'me']);
    Route::post('/auth/logout', [Auth\AuthController::class, 'logout']);
    Route::put('/auth/password', [Auth\PasswordController::class, 'update']);
    Route::put('/auth/preferences', [Auth\PreferenceController::class, 'update']);

    Route::middleware('password.changed')->group(function () {
        Route::put('/auth/company', [Auth\CompanySwitchController::class, 'update']);
        Route::get('/dashboard', Api\DashboardController::class);

        // ── Organization ─────────────────────────────────────────
        // Companies are the reference CRUD module: copy these routes for a new module.
        Route::get('companies', [Api\CompanyController::class, 'index']);
        Route::post('companies', [Api\CompanyController::class, 'store']);
        Route::get('companies/{id}', [Api\CompanyController::class, 'show'])->whereUuid('id');
        Route::put('companies/{id}', [Api\CompanyController::class, 'update'])->whereUuid('id');
        Route::delete('companies/{id}', [Api\CompanyController::class, 'destroy'])->whereUuid('id');
        Route::patch('companies/{id}/status', [Api\CompanyController::class, 'status'])->whereUuid('id');

        // ── Users, roles, permissions ────────────────────────────
        Route::get('users', [Api\UserController::class, 'index']);
        Route::post('users', [Api\UserController::class, 'store']);
        Route::get('users/{id}', [Api\UserController::class, 'show'])->whereNumber('id');
        Route::put('users/{id}', [Api\UserController::class, 'update'])->whereNumber('id');
        Route::patch('users/{id}/status', [Api\UserController::class, 'status'])->whereNumber('id');
        Route::post('users/{id}/reset-password', [Api\UserController::class, 'resetPassword'])->whereNumber('id');

        Route::apiResource('roles', Api\RoleController::class);
        Route::get('permissions', [Api\PermissionController::class, 'index']);

        Route::get('activity-logs', [Api\ActivityLogController::class, 'index']);
        Route::get('activity-logs/{activityLog}', [Api\ActivityLogController::class, 'show']);

        // ── Dropdown lists ───────────────────────────────────────
        Route::prefix('lookups')->controller(Api\LookupController::class)->group(function () {
            foreach (['roles', 'companies', 'users'] as $list) {
                Route::get($list, $list);
            }
        });
    });
});
