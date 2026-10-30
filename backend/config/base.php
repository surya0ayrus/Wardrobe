<?php

return [
    // Password given to every new login (Users page, or reset by an admin). The user must
    // change it on first login.
    'default_password' => env('APP_DEFAULT_PASSWORD', 'Welcome@123'),

    // The one fixed role. It passes every permission check and cannot be edited or deleted.
    'super_admin_role' => 'SuperAdmin',

    // Administrators: the role starts with every permission; only the SuperAdmin may change it
    // or give it to someone.
    'admin_role' => 'Admin',

    // The everyday role ("normal user"). Its permissions are set on the Roles page; it cannot be
    // renamed or deleted.
    'default_role' => env('APP_DEFAULT_ROLE', 'User'),

    // First SuperAdmin account (created by the seeder).
    'super_admin' => [
        'username' => env('SUPERADMIN_USERNAME', 'superadmin'),
        'email' => env('SUPERADMIN_EMAIL', 'superadmin@example.com'),
        'password' => env('SUPERADMIN_PASSWORD', 'Admin@123'),
    ],

    // First company (created by the seeder); more are added on the Companies page.
    'default_company' => [
        'name' => env('DEFAULT_COMPANY_NAME', 'My Company Pvt Ltd'),
        'short_name' => env('DEFAULT_COMPANY_SHORT_NAME', 'MAIN'),
    ],

    // How long dropdown lists stay cached (seconds). They are also cleared on every change.
    'lookup_cache_ttl' => 86400,
];
