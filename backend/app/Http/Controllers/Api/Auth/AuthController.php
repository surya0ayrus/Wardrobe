<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * One field accepts the username or the email.
     */
    public function login(Request $request): JsonResponse
    {
        // Session login works only from the web app's own address (SANCTUM_STATEFUL_DOMAINS).
        abort_unless($request->hasSession(), 400, 'Login is only available from the web app.');

        $data = $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        $login = mb_strtolower(trim($data['login']));
        $user = User::query()
            ->where(fn ($q) => $q->where('username', $login)->orWhere('email', $login))
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Recorded for security review (shown as high risk in the activity log).
            ActivityLogger::log('login_failed', $user, null, ['login' => $login]);

            throw ValidationException::withMessages(['login' => 'Invalid username/email or password.']);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages(['login' => 'Your account is inactive. Please contact the administrator.']);
        }

        Auth::guard('web')->login($user, $data['remember'] ?? false);
        $request->session()->regenerate();

        // Keep the last company if still allowed, otherwise pick the first one.
        if (! $user->current_company_id || ! $user->canAccessCompany($user->current_company_id)) {
            $user->current_company_id = $user->accessibleCompanies()->value('id');
        }
        $user->last_login_at = now();
        $user->saveQuietly();

        ActivityLogger::log('login', $user);

        return response()->json($this->sessionData($user));
    }

    public function logout(Request $request): JsonResponse
    {
        ActivityLogger::log('logout', $request->user());

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->sessionData($request->user()));
    }

    /**
     * Everything the React app needs after login: who, which companies, what they may do.
     */
    public static function sessionData(User $user): array
    {
        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'must_change_password' => $user->is_first_login,
                'is_super_admin' => $user->isSuperAdmin(),
            ],
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
            'companies' => $user->accessibleCompanies()->get(['id', 'name', 'short_name']),
            'current_company_id' => $user->current_company_id,
            'preferences' => $user->preferences(),
        ];
    }
}
