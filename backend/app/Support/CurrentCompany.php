<?php

namespace App\Support;

use Illuminate\Support\Facades\Auth;

/**
 * The company the logged-in user has switched to. Company data is filtered by it.
 *
 * Set at login, but it can go missing during a session (e.g. the company was deactivated or
 * the user was removed from it): then the first company the user may access is picked and
 * saved, the same choice the login makes.
 */
class CurrentCompany
{
    public static function id(): int
    {
        $user = Auth::user();
        $companyId = $user?->current_company_id;

        if ($user && (! $companyId || ! $user->canAccessCompany($companyId))) {
            $companyId = $user->accessibleCompanies()->value('id');
            $user->forceFill(['current_company_id' => $companyId])->saveQuietly();
        }

        abort_if(! $companyId, 409, 'You do not have access to any active company. Ask an administrator to add you to one.');

        return $companyId;
    }
}
