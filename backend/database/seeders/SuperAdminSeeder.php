<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The first login. It belongs to no company (SuperAdmins reach all of them) and must change
 * its password at first login.
 */
class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $config = config('base.super_admin');

        $user = User::firstOrCreate(['username' => $config['username']], [
            'name' => 'Super Admin',
            'email' => $config['email'],
            'password' => $config['password'],
            'is_first_login' => true,
        ]);

        $user->assignRole(config('base.super_admin_role'));
    }
}
