<?php

namespace App\Policies;

use App\Models\User;

/**
 * Checks permissions named "{action}_{resource}", e.g. update_company.
 * view_* covers both the list (viewAny) and one record (view).
 * Each policy only sets $resource. SuperAdmin passes everything (see AppServiceProvider).
 */
abstract class CrudPolicy
{
    protected string $resource;

    public function viewAny(User $user): bool
    {
        return $user->can("view_{$this->resource}");
    }

    public function view(User $user): bool
    {
        return $user->can("view_{$this->resource}");
    }

    public function create(User $user): bool
    {
        return $user->can("create_{$this->resource}");
    }

    public function update(User $user): bool
    {
        return $user->can("update_{$this->resource}");
    }

    public function delete(User $user): bool
    {
        return $user->can("delete_{$this->resource}");
    }
}
