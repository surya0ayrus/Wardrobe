<?php

namespace App\Models;

use App\Models\Concerns\HasAuditColumns;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** Cache for accessibleCompanyIds(). */
    private ?array $accessibleCompanyIds = null;

    use HasApiTokens, HasAuditColumns, HasRoles, LogsActivity, Notifiable, SoftDeletes;

    protected $guard_name = 'web';

    protected $attributes = ['is_active' => true];

    protected $fillable = [
        'name', 'username', 'email', 'phone', 'password',
        'is_active', 'is_first_login', 'current_company_id', 'timezone', 'last_login_at',
    ];

    protected $hidden = ['password', 'remember_token'];

    /** Default personal preferences; users.settings overrides them. */
    public const DEFAULT_PREFERENCES = [
        'nav_style' => 'top',   // top | side
        'theme' => 'system',    // light | dark | system
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'is_first_login' => 'boolean',
            'last_login_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    /** Stored lower-case so login is not case-sensitive. */
    protected function username(): Attribute
    {
        return Attribute::set(fn ($value) => mb_strtolower(trim($value)));
    }

    protected function email(): Attribute
    {
        return Attribute::set(fn ($value) => $value ? mb_strtolower(trim($value)) : null);
    }

    public function preferences(): array
    {
        return array_merge(self::DEFAULT_PREFERENCES, array_intersect_key($this->settings ?? [], self::DEFAULT_PREFERENCES));
    }

    /** Companies this user is a member of (SuperAdmins reach all of them anyway). */
    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class);
    }

    public function currentCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'current_company_id');
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(config('base.super_admin_role'));
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(config('base.admin_role'));
    }

    /** Companies this user can switch to: all active ones for SuperAdmin, otherwise their own. */
    public function accessibleCompanies(): Builder
    {
        $query = Company::query()->where('is_active', true)->orderBy('id');

        if (! $this->isSuperAdmin()) {
            $query->whereIn('id', fn ($q) => $q->select('company_id')->from('company_user')->where('user_id', $this->id));
        }

        return $query;
    }

    public function canAccessCompany(int $companyId): bool
    {
        return in_array($companyId, $this->accessibleCompanyIds(), true);
    }

    /** Ids of accessibleCompanies(), worked out once per request. */
    public function accessibleCompanyIds(): array
    {
        return $this->accessibleCompanyIds ??= $this->accessibleCompanies()->pluck('id')->all();
    }

    /** Members of the given company. */
    public function scopeInCompany(Builder $query, int $companyId): void
    {
        $query->whereExists(fn ($sub) => $sub->from('company_user')
            ->whereColumn('company_user.user_id', 'users.id')
            ->where('company_user.company_id', $companyId));
    }
}
