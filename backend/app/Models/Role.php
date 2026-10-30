<?php

namespace App\Models;

use App\Models\Concerns\ClearsLookupCache;
use App\Models\Concerns\HasPublicId;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Spatie's role (see config/permission.php), addressed in URLs by its uuid.
 * Any change clears the cached roles dropdown.
 */
class Role extends SpatieRole
{
    use ClearsLookupCache, HasPublicId;

    public function lookupCacheKeys(): array
    {
        return ['lookups:roles'];
    }
}
