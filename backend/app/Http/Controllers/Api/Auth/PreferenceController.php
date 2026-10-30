<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PreferenceController extends Controller
{
    /**
     * Save own layout / theme choice. Send only what changed.
     * Not written to the activity log (personal display setting).
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'nav_style' => ['sometimes', Rule::in(['top', 'side'])],
            'theme' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
        ]);

        $user = $request->user();
        $user->forceFill(['settings' => array_merge($user->settings ?? [], $data)])->saveQuietly();

        return response()->json(['preferences' => $user->preferences()]);
    }
}
