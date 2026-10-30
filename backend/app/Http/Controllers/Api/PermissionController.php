<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

/**
 * The permission matrix for the Roles screen, built from config/permissions.php.
 */
class PermissionController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', Role::class);

        $config = config('permissions');

        $resource = fn (string $key) => [
            'key' => $key,
            'label' => $config['resources'][$key]['label'],
            'permissions' => collect($config['resources'][$key]['actions'])->map(fn ($action) => [
                'action' => $action,
                'name' => "{$action}_{$key}",
            ])->values(),
        ];

        // Resources grouped as in the menu; anything not listed in a group goes under "Other".
        $grouped = collect($config['groups'])->flatten()->all();
        $groups = collect($config['groups'])
            ->map(fn ($keys, $label) => ['label' => $label, 'resources' => collect($keys)->map($resource)->values()])
            ->values();
        $other = collect(array_keys($config['resources']))->diff($grouped)->values();
        if ($other->isNotEmpty()) {
            $groups->push(['label' => 'Other', 'resources' => $other->map($resource)->values()]);
        }

        return response()->json([
            'actions' => $config['actions'],
            'groups' => $groups,
        ]);
    }
}
