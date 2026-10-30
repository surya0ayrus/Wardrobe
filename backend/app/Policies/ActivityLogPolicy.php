<?php

namespace App\Policies;

class ActivityLogPolicy extends CrudPolicy
{
    protected string $resource = 'activity_log';
}
