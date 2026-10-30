<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class PasswordController extends Controller
{
    /**
     * Change own password (also the forced change on first login).
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', 'different:current_password', Password::min(8)->letters()->numbers()],
        ]);

        $user = $request->user();
        $user->forceFill(['password' => $data['password'], 'is_first_login' => false])->saveQuietly();

        ActivityLogger::log('password_changed', $user);

        return response()->json(AuthController::sessionData($user));
    }
}
