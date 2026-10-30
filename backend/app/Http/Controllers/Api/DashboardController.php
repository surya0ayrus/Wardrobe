<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use App\Models\User;
use App\Support\CurrentCompany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The home page's numbers. Each block is added only for people who may see that module;
 * add a block here for each new module.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $companyId = CurrentCompany::id();
        $data = [];

        if ($user->can('viewAny', User::class)) {
            $counts = User::query()->inCompany($companyId)->toBase()
                ->selectRaw('count(*) as total')
                ->selectRaw('count(*) filter (where is_active) as active')
                ->selectRaw('count(*) filter (where last_login_at >= ?) as active_this_week', [now()->subWeek()])
                ->first();

            $data['users'] = [
                'total' => (int) $counts->total,
                'active' => (int) $counts->active,
                'inactive' => (int) $counts->total - (int) $counts->active,
                'active_this_week' => (int) $counts->active_this_week,
            ];
        }

        if ($user->can('viewAny', ActivityLog::class)) {
            $data['recent_activity'] = ActivityLogResource::collection(
                ActivityLog::query()->with('user:id,name')->latest('id')->limit(8)->get()
            );
        }

        return response()->json($data);
    }
}
