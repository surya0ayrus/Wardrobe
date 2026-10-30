<?php

/*
| The full list of permissions, in one place:
|   "{action}_{resource}"  e.g. view_user, update_role
|
| view_* opens both the list and a record.
|
| Used by the seeder (creates them) and by the Roles screen (permission matrix).
| Roles themselves are created in the UI. To add a module: add its resource here,
| add it to a group, run `php artisan db:seed --class=PermissionSeeder`.
*/

$crud = ['view', 'create', 'update', 'delete'];

return [
    // Columns of the Roles matrix, in order.
    'actions' => $crud,

    // Headings in the Roles screen, in menu order: group => resources.
    'groups' => [
        'Organization' => ['company'],
        'User management' => ['user', 'role', 'activity_log'],
    ],

    // resource => [label, actions]
    'resources' => [
        'company' => ['label' => 'Companies', 'actions' => $crud],
        'user' => ['label' => 'Users', 'actions' => ['view', 'create', 'update']],
        'role' => ['label' => 'Roles', 'actions' => $crud],
        'activity_log' => ['label' => 'Activity Logs', 'actions' => ['view']],
    ],
];
