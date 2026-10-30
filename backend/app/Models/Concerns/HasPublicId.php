<?php

namespace App\Models\Concerns;

use Illuminate\Support\Str;

/**
 * The record is addressed in URLs by a random `uuid` column instead of its numeric id
 * (route model binding uses it too). The id stays the primary key.
 */
trait HasPublicId
{
    protected static function bootHasPublicId(): void
    {
        static::creating(function ($model) {
            $model->uuid ??= (string) Str::uuid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
