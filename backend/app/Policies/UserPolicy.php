<?php

namespace App\Policies;

class UserPolicy extends CrudPolicy
{
    protected string $resource = 'user';
}
