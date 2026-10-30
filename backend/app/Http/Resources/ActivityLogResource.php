<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid, // used in URLs instead of the id
            'action' => $this->action,
            'module' => $this->loggable_type,
            'record_id' => $this->loggable_id,
            'user' => $this->whenLoaded('user', fn () => $this->user ? array_filter($this->user->only('id', 'name', 'username', 'email'), fn ($v) => $v !== null) : null),
            'old_values' => $this->old_values,
            'new_values' => $this->new_values,
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'url' => $this->url,
            'method' => $this->method,
            'created_at' => $this->created_at,
        ];
    }
}
