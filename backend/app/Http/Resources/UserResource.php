<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    use AuditFields;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'phone' => $this->phone,
            'is_first_login' => $this->is_first_login,
            'last_login_at' => $this->last_login_at,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map->only('id', 'name')),
            'companies' => $this->whenLoaded('companies', fn () => $this->companies->map->only('id', 'name', 'short_name')),
            ...$this->auditFields(),
        ];
    }
}
