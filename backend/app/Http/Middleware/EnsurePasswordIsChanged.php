<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Blocks the API until a first-login user has set their own password (Change password page). */
class EnsurePasswordIsChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->is_first_login) {
            return response()->json([
                'message' => 'Please change your password to continue.',
                'code' => 'password_change_required',
            ], 403);
        }

        return $next($request);
    }
}
