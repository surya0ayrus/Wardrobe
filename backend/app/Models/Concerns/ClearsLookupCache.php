<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Cache;

/**
 * Clears cached dropdown lists whenever the model changes.
 * The model defines lookupCacheKeys() returning the keys to forget.
 */
trait ClearsLookupCache
{
    abstract public function lookupCacheKeys(): array;

    public static function bootClearsLookupCache(): void
    {
        $clear = fn ($model) => array_map(fn ($key) => Cache::forget($key), $model->lookupCacheKeys());

        static::saved($clear);
        static::deleted($clear);
    }
}
