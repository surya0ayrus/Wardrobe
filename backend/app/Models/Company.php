<?php

namespace App\Models;

use App\Models\Concerns\ClearsLookupCache;
use App\Models\Concerns\HasAuditColumns;
use App\Models\Concerns\HasPublicId;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A company users work for. Company data is filtered by the user's current company
 * (see App\Support\CurrentCompany).
 */
class Company extends Model
{
    use ClearsLookupCache, HasAuditColumns, HasPublicId, LogsActivity, SoftDeletes;

    protected $attributes = ['is_active' => true];

    protected $fillable = [
        'name', 'short_name', 'gstin', 'pan', 'email', 'phone',
        'address', 'city', 'pincode', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function lookupCacheKeys(): array
    {
        return ['lookups:companies'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
