<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanySwitchController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate(['company_id' => ['required', 'integer']]);
        $user = $request->user();

        abort_unless($user->canAccessCompany($data['company_id']), 403, 'You do not have access to this company.');

        $user->forceFill(['current_company_id' => $data['company_id']])->saveQuietly();

        return response()->json(['current_company_id' => $user->current_company_id]);
    }
}
