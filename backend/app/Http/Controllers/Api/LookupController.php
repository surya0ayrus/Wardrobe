<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Role;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Small id + name lists for dropdowns. Cached, and cleared automatically when
 * the data changes (see the ClearsLookupCache trait on the models).
 * Only active records are listed.
 */
class LookupController extends Controller
{
    public function roles(): JsonResponse
    {
        return $this->cached('lookups:roles', fn () => Role::orderBy('name')->get(['id', 'name']));
    }

    /** Companies the user may give to others (the ones they can reach themselves). Not cached: per user. */
    public function companies(Request $request): JsonResponse
    {
        return response()->json($request->user()->accessibleCompanies()->get(['id', 'name', 'short_name']));
    }

    /**
     * User search for pickers and the quick search (Ctrl+K), in the current company.
     * Not cached (search text changes); returns at most 20 rows.
     */
    public function users(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search'));

        $users = User::query()
            ->inCompany(CurrentCompany::id())
            ->where('is_active', true)
            ->when($search, function ($q) use ($search) {
                $term = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn ($w) => $w->where('name', 'ilike', $term)->orWhere('username', 'ilike', $term));
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'username']);

        return response()->json($users);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private function cached(string $key, callable $query): JsonResponse
    {
        return response()->json(Cache::remember($key, config('base.lookup_cache_ttl'), fn () => $query()->toArray()));
    }
}
