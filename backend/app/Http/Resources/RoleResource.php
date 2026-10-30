<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RoleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid, // used in URLs instead of the id
            'name' => $this->name,
            'is_super_admin' => $this->name === config('base.super_admin_role'),
            // The everyday role: name fixed, cannot be deleted, permissions editable.
            'is_default' => $this->name === config('base.default_role'),
            'is_admin' => $this->name === config('base.admin_role'), // only the SuperAdmin may change it
            'users_count' => $this->whenCounted('users'),
            'permissions_count' => $this->whenCounted('permissions'),
            'permissions' => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
